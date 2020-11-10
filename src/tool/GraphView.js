import {useUserColorManager} from '@sanity/base/user-color'
import {color, COLOR_HUES} from '@sanity/color'
import {rgba} from 'polished'
import deepEqual from 'deep-equal'
import React, {useCallback, useEffect, useState} from 'react'
import client from 'part:@sanity/base/client'
import {ForceGraph2D} from 'react-force-graph'
import {v4 as uuidv4} from 'uuid'
import BezierEasing from 'bezier-easing'
import {useRouter} from 'part:@sanity/base/router'
import pluginConfig from 'config:graph-view'

import {useFetchDocuments, useListen} from './hooks'
import styles from './GraphView.css'
import {sortBy, loadImage, sizeOf, truncate} from './utils'

const DEFAULT_QUERY = `
  *[
    !(_id in path("_.*")) &&
    !(_type match "system.*") &&
    _type != "sanity.imageAsset"
  ]
`
const fadeEasing = BezierEasing(0, 0.9, 1, 1)
const softEasing = BezierEasing(0.25, 0.1, 0.0, 1.0)
const idleTimeout = 10000
const imageSize = 40

function getTopDocTypes(counts) {
  return sortBy(Object.keys(counts), (docType) => counts[docType] || 0)
    .reverse()
    .slice(0, 10)
}

function formatDocType(docType) {
  return (docType.substring(0, 1).toUpperCase() + docType.substring(1))
    .replace(/\./g, ' ')
    .replace(/[A-Z]/g, ' $&')
    .trim()
}

function getDocTypeCounts(docs) {
  const types = {}
  for (const doc of docs) {
    types[doc._type] = (types[doc._type] || 0) + 1
  }
  return types
}

function labelFor(doc) {
  return `${doc.title || doc.name || doc._id}`.trim()
}

function valueFor(doc, maxSize) {
  return 5 + 100 * (sizeOf(doc) / maxSize)
}

function findRefs(obj, dest = []) {
  if (obj != null) {
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (k === '_ref' && typeof v === 'string' && v.length > 0) {
          dest.push(stripDraftId(v))
        }
        findRefs(v, dest)
      }
    } else if (Array.isArray(obj)) {
      for (let v of obj) {
        findRefs(v, dest)
      }
    }
  }
  return dest
}

function stripDraftId(id) {
  return id.replace(/^drafts\./, '')
}

function deduplicateDrafts(docs) {
  let deduped = {}
  for (let doc of docs) {
    if (!/^drafts\./.test(doc._id)) {
      deduped[doc._id] = doc
    }
  }
  for (let doc of docs) {
    if (/^drafts\./.test(doc._id)) {
      const id = stripDraftId(doc._id)
      deduped[id] = Object.assign(doc, {_id: id})
    }
  }
  return Object.values(deduped)
}

class Users {
  _users = []

  async getById(id) {
    let user = this._users.find((u) => u._id === id)
    if (!user) {
      user = await client.users.getById(id)
      this._users.push(user)
      user.image = await loadImage(
        user.imageUrl ||
          'https://raw.githubusercontent.com/sanity-io/sanity-plugin-graph-view/main/assets/head-silhouette.jpg',
        imageSize,
        imageSize
      )
    }
    return user
  }
}

class Session {
  user = null
  doc = null
  lastActive = null
}

class GraphData {
  sessions = []

  constructor(docs = []) {
    let docsById = {}
    for (let doc of docs) {
      docsById[doc._id] = doc
    }

    this.data = {
      nodes: docs.map((d) => Object.assign({id: d._id, type: 'document', doc: d})),
      links: docs
        .flatMap((doc) => findRefs(doc).map((ref) => ({source: doc._id, target: ref})))
        .filter((link) => docsById[link.source] && docsById[link.target]),
    }
  }

  setSession(user, docNode) {
    let session = this.sessions.find((s) => s.user.id === user.id && s.doc._id === docNode.doc._id)
    if (!session) {
      session = new Session()
      session.id = uuidv4()
      session.user = user
      session.startTime = Date.now()
      session.doc = docNode.doc
      session.angle = Math.random() * 2 * Math.PI
      this.sessions.push(session)
    }
    session.lastActive = Date.now()
  }

  reapSessions() {
    for (let i = 0; i < this.sessions.length; i++) {
      const session = this.sessions[i]
      if (Date.now() - session.lastActive > idleTimeout) {
        this.sessions = [...this.sessions.slice(0, i), ...this.sessions.slice(i + 1)]
        i--
      }
    }
  }

  clone() {
    let copy = new GraphData()
    Object.assign(copy, this)
    copy.data = {
      nodes: [...this.data.nodes],
      links: [...this.data.links],
    }
    return copy
  }
}

const users = new Users()

export function GraphView() {
  const query = pluginConfig.query || DEFAULT_QUERY

  const userColorManager = useUserColorManager()
  const [maxSize, setMaxSize] = useState(0)
  const [hoverNode, setHoverNode] = useState(null)
  const [documents, setDocuments] = useState([])
  const [docTypes, setDocTypes] = useState([])
  const [graph, setGraph] = useState(() => new GraphData())
  const router = useRouter()

  const fetchCallback = useCallback((docs) => {
    docs = deduplicateDrafts(docs)
    setMaxSize(Math.max(...docs.map(sizeOf)))
    setDocuments(docs)
    setDocTypes(getDocTypeCounts(docs))
    setGraph(new GraphData(docs))
  }, [])

  const listenCallback = useCallback(
    async (update) => {
      const doc = update.result
      if (doc) {
        doc._id = stripDraftId(doc._id)

        let docsById = {}
        for (let doc of documents) {
          docsById[doc._id] = doc
        }

        let oldDoc
        const docs = [...documents]
        const idx = documents.findIndex((d) => d._id === doc._id)
        if (idx >= 0) {
          oldDoc = docs[idx]
          docs[idx] = doc
        } else {
          docs.push(doc)
        }
        setDocuments(docs)
        setDocTypes(getDocTypeCounts(docs))
        setMaxSize(Math.max(...docs.map(sizeOf)))

        const newGraph = graph.clone()

        const oldRefs = findRefs(oldDoc || {}).filter(
          (id) => id === doc._id || docsById[id] != null
        )
        const newRefs = findRefs(doc).filter((id) => id === doc._id || docsById[id] != null)

        let graphChanged = !deepEqual(oldRefs, newRefs)
        if (graphChanged) {
          newGraph.data.links = newGraph.data.links
            .filter((l) => l.source.id !== doc._id)
            .concat(newRefs.map((ref) => ({source: doc._id, target: ref})))
        }

        let docNode
        const nodeIdx = graph.data.nodes.findIndex((n) => n.doc && n.doc._id === doc._id)
        if (nodeIdx >= 0) {
          docNode = graph.data.nodes[nodeIdx]
          docNode.doc = doc
        } else {
          docNode = {id: doc._id, type: 'document', doc: doc}
          newGraph.data.nodes.push(docNode)
          graphChanged = true
        }
        if (graphChanged) {
          setGraph(newGraph)
        }

        const user = await users.getById(update.identity)
        graph.setSession(user, docNode)
      } else if (update.transition === 'disappear') {
        const docId = stripDraftId(update.documentId)

        const docs = documents.filter((d) => d._id !== docId)
        setDocuments(docs)
        setDocTypes(getDocTypeCounts(docs))
        setMaxSize(Math.max(...docs.map(sizeOf)))

        const newGraph = graph.clone()
        newGraph.data.links = newGraph.data.links.filter(
          (l) => l.source.id !== docId && l.target.id !== docId
        )
        newGraph.data.nodes = newGraph.data.nodes.filter((n) => n.id !== docId)
        setGraph(newGraph)
      }
    },
    [documents, graph]
  )
  useFetchDocuments(query, fetchCallback, [])
  useListen(query, {}, {}, listenCallback, [documents, graph])
  useEffect(() => {
    const interval = setInterval(() => graph.reapSessions(), 1000)
    return () => clearInterval(interval)
  }, [graph])

  return (
    <div className={styles.root} style={{background: color.black.hex}}>
      <div className={styles.legend}>
        {getTopDocTypes(docTypes).map((docType) => (
          <div
            className={styles.legend__row}
            key={docType}
            style={{color: getDocTypeColor(docType).fill}}
          >
            <div className={styles.legend__badge} />
            <div className={styles.legend__title}>{formatDocType(docType)}</div>
          </div>
        ))}
      </div>
      {hoverNode && <div className={styles.hoverNode}>{labelFor(hoverNode.doc)}</div>}

      <ForceGraph2D
        graphData={graph.data}
        nodeAutoColorBy="group"
        numDimensions={2}
        enableNodeDrag={false}
        onNodeHover={(node) => setHoverNode(node)}
        onNodeClick={(node) => {
          router.navigateIntent('edit', {id: node.doc._id, documentType: node.doc._type})
        }}
        linkColor={() => rgba(color.gray[500].hex, 0.25)}
        nodeLabel={() => null}
        nodeRelSize={1}
        nodeVal={(node) => valueFor(node.doc, maxSize)}
        onRenderFramePost={(ctx, globalScale) => {
          for (let session of graph.sessions) {
            const node = graph.data.nodes.find((n) => n.doc && n.doc._id === session.doc._id)
            if (node) {
              const idleFactorRange = idleTimeout
              const angle = session.angle
              const radius = Math.sqrt(valueFor(node.doc, maxSize))
              const image = session.user.image
              const userColor = userColorManager.get(session.user.displayName).tints[400].hex
              const distance = radius * globalScale + 40
              const imgW = image ? image.width : 0
              const imgH = image ? image.height : 0
              const x = node.x + (Math.sin(angle) * distance) / globalScale
              const y = node.y + (Math.cos(angle) * distance) / globalScale

              ctx.save()
              try {
                ctx.globalAlpha = fadeEasing(
                  1 - Math.min(idleFactorRange, Date.now() - session.lastActive) / idleFactorRange
                )
                ctx.font = `bold ${Math.round(12 / globalScale)}px sans-serif`

                ctx.beginPath()
                ctx.strokeStyle = rgba(color.white.hex, 1.0)
                ctx.lineWidth = 2 / globalScale
                ctx.moveTo(
                  node.x + (Math.sin(angle) * (distance - imgW / 2)) / globalScale,
                  node.y + (Math.cos(angle) * (distance - imgH / 2)) / globalScale
                )
                ctx.lineTo(node.x + Math.sin(angle) * radius, node.y + Math.cos(angle) * radius)
                ctx.stroke()

                ctx.beginPath()
                ctx.strokeStyle = rgba(color.white.hex, 1.0)
                ctx.lineWidth = 2 / globalScale
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
                ctx.stroke()

                if (image) {
                  ctx.save()
                  try {
                    const dur = 700
                    const f = softEasing(
                      Math.max(0, (dur - (Date.now() - session.startTime)) / dur)
                    )
                    if (f > 0) {
                      ctx.beginPath()
                      ctx.fillStyle = rgba(userColor, f)
                      ctx.arc(x, y, (imgW / 2 + 10) / globalScale, 0, 2 * Math.PI, false)
                      ctx.fill()
                    }

                    ctx.beginPath()
                    ctx.fillStyle = rgba(color.white.hex, 1.0)
                    ctx.arc(x, y, imgW / globalScale / 2, 0, 2 * Math.PI, false)
                    ctx.clip()

                    ctx.drawImage(
                      image,
                      x - imgW / globalScale / 2,
                      y - imgH / globalScale / 2,
                      imgW / globalScale,
                      imgH / globalScale
                    )

                    ctx.strokeStyle = color.black.hex
                    ctx.lineWidth = 6 / globalScale
                    ctx.stroke()

                    ctx.strokeStyle = userColor
                    ctx.lineWidth = 4 / globalScale
                    ctx.stroke()
                  } finally {
                    ctx.restore()
                  }
                }

                ctx.beginPath()
                ctx.strokeStyle = rgba(color.black.hex, 1)
                ctx.lineWidth = 0.5 / globalScale
                ctx.arc(x, y, imgW / globalScale / 2, 0, 2 * Math.PI, false)
                ctx.stroke()

                const above = angle >= Math.PI / 2 && angle < Math.PI * 1.5
                const textY = above
                  ? y - (imgH / 2 + 5) / globalScale
                  : y + (imgH / 2 + 5) / globalScale
                ctx.fillStyle = rgba(color.white.hex, 1.0)
                ctx.textAlign = 'center'
                ctx.textBaseline = above ? 'bottom' : 'top'
                ctx.fillText(session.user.displayName, x, textY)
              } finally {
                ctx.restore()
              }
            }
          }
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          switch (node.type) {
            case 'document': {
              const nodeColor = getDocTypeColor(node.doc._type)
              const radius = Math.sqrt(valueFor(node.doc, maxSize))
              const fontSize = Math.min(100, 10.0 / globalScale)

              ctx.beginPath()
              ctx.fillStyle =
                hoverNode != null && node.doc._id === hoverNode.doc._id
                  ? rgba(color.gray[500].hex, 0.8)
                  : nodeColor.fill
              ctx.strokeStyle = nodeColor.border
              ctx.lineWidth = 0.5
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
              ctx.stroke()
              ctx.fill()

              if (radius * globalScale > 10) {
                ctx.font = `${fontSize}px sans-serif`
                let w = radius * 2 + 30 / globalScale
                for (let len = 50; len >= 5; len /= 1.2) {
                  const label = truncate(labelFor(node.doc), Math.round(len))
                  const textMetrics = ctx.measureText(label)
                  if (textMetrics.width < w) {
                    // ctx.fillStyle = rgba(color.white.hex, 1.0)
                    ctx.textAlign = 'center'
                    ctx.textBaseline = 'top'

                    ctx.strokeStyle = rgba(color.black.hex, 0.5)
                    ctx.lineWidth = 2 / globalScale
                    ctx.strokeText(label, node.x, node.y + radius + 5 / globalScale)

                    ctx.fillText(label, node.x, node.y + radius + 5 / globalScale)
                    break
                  }
                }
              }
            }
          }
        }}
        linkCanvasObject={(link, ctx, globalScale) => {
          ctx.beginPath()
          ctx.strokeStyle = rgba(color.gray[500].hex, 0.125)
          ctx.lineWidth = 2 / globalScale
          ctx.moveTo(link.source.x, link.source.y)
          ctx.lineTo(link.target.x, link.target.y)
          ctx.stroke()
        }}
      />
    </div>
  )
}

const colorCache = {}
let typeColorNum = 0

function getDocTypeColor(docType) {
  if (colorCache[docType]) {
    return colorCache[docType]
  }

  const hue = COLOR_HUES[typeColorNum % COLOR_HUES.length]

  typeColorNum += 1

  colorCache[docType] = {
    fill: color[hue][400].hex,
    border: rgba(color.black.hex, 0.5),
  }

  return colorCache[docType]
}
