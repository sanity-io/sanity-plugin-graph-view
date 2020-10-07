import {useUserColorManager} from '@sanity/base/user-color'
import {color, COLOR_HUES} from '@sanity/color'
import {rgba} from 'polished'
import deepEqual from 'deep-equal'
import React, {useCallback, useEffect, useState} from 'react'
import client from 'part:@sanity/base/client'
import {ForceGraph2D} from 'react-force-graph'
import {v4 as uuidv4} from 'uuid'
import BezierEasing from 'bezier-easing'

// import styles from './GraphTool.css'
import {useFetchDocuments, useListen} from './hooks'

import styles from './GraphTool.css'

const QUERY = `
  *[
    !(_id in path("_.*")) &&
    !(_type match "system.*") &&
    !(_type match "mux.*") &&
    !(_type match "workflow.*") &&
    _type != "feedback" &&
    _type != "sanity.imageAsset"
  ]
`

const fadeEasing = BezierEasing(0, 0.9, 1, 1)
const imageSize = 40

function sortBy(array, f) {
  return array.sort((a, b) => {
    const va = f(a)
    const vb = f(b)
    return va < vb ? -1 : va > vb ? 1 : 0
  })
}

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

function hashStringToInt(s) {
  let hash = 0
  for (let i = 0; i < s.length; i++) {
    hash += s.charCodeAt(i)
  }
  return hash
}

function getDocTypeCounts(docs) {
  const types = {}
  for (const doc of docs) {
    types[doc._type] = (types[doc._type] || 0) + 1
  }
  return types
}

function truncate(s, limit) {
  if (s.length > limit) {
    s = s.substring(0, limit) + '…'
  }
  return s
}

function labelFor(doc) {
  return `${doc.title || doc.name || doc._id}`
}

function valueFor(node, maxSize) {
  switch (node.type) {
    case 'session':
      return 5
    default:
      return 5 + 100 * (sizeOf(node) / maxSize)
  }
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

function sizeOf(value) {
  if (value == null) {
    return 0
  }

  if (typeof value === 'object') {
    return Object.entries(value).reduce((total, [k, v]) => total + sizeOf(k) + sizeOf(v), 0)
  }

  if (Array.isArray(value)) {
    return Object.entries(value).reduce((total, v) => total + sizeOf(v), 0)
  }

  if (typeof value === 'string') {
    return value.length
  }

  return 1
}

function loadImage(url) {
  return new Promise((resolve, reject) => {
    let img = new Image(imageSize, imageSize)
    img.onload = () => {
      resolve(img)
    }
    img.src = url
  })
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

      if (user.imageUrl) {
        user.image = await loadImage(user.imageUrl)
      }
    }
    return user
  }
}

const users = new Users()

const idleTimeout = 10000

class EditSession {
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

  setEditSession(user, docNode) {
    let session = this.sessions.find((s) => s.user.id === user.id && s.doc._id === docNode.doc._id)
    if (!session) {
      session = new EditSession()
      session.id = uuidv4()
      session.user = user
      session.doc = docNode.doc
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

export function GraphTool() {
  const userColorManager = useUserColorManager()
  const [maxSize, setMaxSize] = useState(0)
  const [hoverNode, setHoverNode] = useState(null)
  const [documents, setDocuments] = useState([])
  const [docTypes, setDocTypes] = useState([])
  const [graph, setGraph] = useState(() => new GraphData())

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

        const newGraph = graph.clone()
        let graphChanged = false
        if (oldDoc) {
          const oldRefs = findRefs(oldDoc)
          const newRefs = findRefs(doc)
          if (!deepEqual(oldRefs, newRefs)) {
            graphChanged = true
            newGraph.data.links = newGraph.data.links
              .filter((l) => l.source.id !== doc._id)
              .concat(newRefs.map((ref) => ({source: doc._id, target: ref})))
              .filter(
                (link) =>
                  link.source == doc._id ||
                  link.target == doc._id ||
                  (docsById[link.source] && docsById[link.target])
              )
          }
        }

        setMaxSize(Math.max(...docs.map(sizeOf)))

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
        graph.setEditSession(user, docNode)
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

  useFetchDocuments(QUERY, fetchCallback, [])
  useListen(QUERY, {}, {}, listenCallback, [documents, graph])

  useEffect(() => {
    const interval = setInterval(() => {
      graph.reapSessions()
    }, 1000)
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
        linkColor={() => rgba(color.gray[500].hex, 0.25)}
        nodeLabel={(node) => labelFor(node.doc)}
        nodeRelSize={1}
        nodeVal={(node) => valueFor(node, maxSize)}
        onRenderFramePost={(ctx, globalScale) => {
          for (let session of graph.sessions) {
            const node = graph.data.nodes.find((n) => n.doc && n.doc._id === session.doc._id)
            if (node) {
              const idleFactorRange = idleTimeout

              ctx.save()
              ctx.globalAlpha = fadeEasing(
                1 - Math.min(idleFactorRange, Date.now() - session.lastActive) / idleFactorRange
              )
              ctx.font = `${Math.round(12 / globalScale)}px sans-serif`

              const orient = hashStringToInt(session.id) % 2 === 0
              const label = truncate(labelFor(session.doc), 30)
              const textMetrics = ctx.measureText(label)

              const imgMargin = 10 / globalScale
              const labelMarginY = 5 / globalScale
              const w = textMetrics.width + imgMargin
              const x = orient ? node.x - w : node.x + labelMarginY
              const y = node.y
              const image = session.user.image
              const imgW = image.width / globalScale
              const imgH = image.height / globalScale
              const imgX = orient ? x - imgW - imgMargin : x + w + imgMargin
              const imgY = y - imgH * 0.7

              ctx.beginPath()
              ctx.strokeStyle = rgba(color.white.hex, 1.0)
              ctx.lineWidth = 1 / globalScale
              if (orient) {
                ctx.moveTo(x, y)
                ctx.lineTo(node.x, node.y)
              } else {
                ctx.moveTo(x + w, y)
                ctx.lineTo(node.x, node.y)
              }
              ctx.stroke()

              if (session.doc) {
                ctx.fillStyle = rgba(color.white.hex, 1.0)
                ctx.textAlign = 'left'
                ctx.textBaseline = 'bottom'
                if (orient) {
                  ctx.fillText(label, x, y - labelMarginY, w)
                } else {
                  ctx.fillText(label, x + w - textMetrics.width, y - labelMarginY, w)
                }
              }

              ctx.beginPath()
              ctx.fillStyle = rgba(color.white.hex, 1.0)
              ctx.arc(node.x, node.y, 3 / globalScale, 0, 2 * Math.PI, false)
              ctx.fill()

              ctx.save()
              ctx.beginPath()
              ctx.fillStyle = rgba(color.white.hex, 1.0)
              ctx.arc(imgX + imgW / 2, imgY + imgH / 2, imgW / 2, 0, 2 * Math.PI, false)
              ctx.clip()
              ctx.drawImage(image, imgX, imgY, imgW, imgH)
              ctx.strokeStyle = color.black.hex
              ctx.lineWidth = 5 / globalScale
              ctx.stroke()
              ctx.strokeStyle = userColorManager.get(session.user.id).tints[400].hex
              ctx.lineWidth = 4 / globalScale
              ctx.stroke()

              ctx.restore()

              ctx.beginPath()
              ctx.strokeStyle = rgba(color.black.hex, 1)
              ctx.lineWidth = 0.5 / globalScale
              ctx.arc(imgX + imgW / 2, imgY + imgH / 2, imgW / 2, 0, 2 * Math.PI, false)
              ctx.stroke()

              ctx.restore()
            }
          }
        }}
        nodeCanvasObject={(node, ctx, globalScale) => {
          switch (node.type) {
            case 'document':
              const nodeColor = getDocTypeColor(node.doc._type)
              const radius = Math.sqrt(valueFor(node, maxSize))

              ctx.beginPath()
              ctx.fillStyle = nodeColor.fill
              ctx.strokeStyle = nodeColor.border
              ctx.lineWidth = 0.5
              ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
              ctx.stroke()
              ctx.fill()
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
