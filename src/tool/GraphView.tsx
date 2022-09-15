import {useUserColorManager} from 'sanity/_unstable'
import {rgba} from 'polished'
import deepEqual from 'deep-equal'
import React, {useCallback, useEffect, useState} from 'react'
import {ForceGraph2D} from 'react-force-graph'
import {v4 as uuidv4} from 'uuid'
import BezierEasing from 'bezier-easing'
import {useFetchDocuments, useListen} from './hooks'
import {sortBy, loadImage, sizeOf, truncate} from './utils'
import {SanityDocument, SanityClient} from '@sanity/client'
import {useClient, useRouter} from 'sanity'
import {GraphRoot, GraphWrapper, HoverNode, Legend, LegendBadge, LegendRow} from './GraphViewStyle'
import {useTheme} from '@sanity/ui'
import {black, COLOR_HUES, gray, white, hues} from '@sanity/color'

const DEFAULT_QUERY = `
  *[
    !(_id in path("_.*")) &&
    !(_type match "system.*") &&
    !(_type match "sanity.*")
  ]
`

const fadeEasing = BezierEasing(0, 0.9, 1, 1)
const softEasing = BezierEasing(0.25, 0.1, 0.0, 1.0)
const idleTimeout = 10000
const imageSize = 40

function getTopDocTypes(counts: Record<string, number>) {
  return sortBy(Object.keys(counts), (docType) => counts[docType] || 0)
    .reverse()
    .slice(0, 10)
}

function formatDocType(docType: string) {
  return (docType.substring(0, 1).toUpperCase() + docType.substring(1))
    .replace(/\./g, ' ')
    .replace(/[A-Z]/g, ' $&')
    .trim()
}

function getDocTypeCounts(docs: SanityDocument[]) {
  const types: Record<string, number> = {}
  for (const doc of docs) {
    types[doc._type] = (types[doc._type] || 0) + 1
  }
  return types
}

function labelFor(doc: SanityDocument) {
  return `${doc.title || doc.name || doc._id}`.trim()
}

function valueFor(doc: any, maxSize: number) {
  return 5 + 100 * (sizeOf(doc) / maxSize)
}

function findRefs(obj: any, dest: any[] = []) {
  if (obj !== null) {
    if (typeof obj === 'object') {
      for (const [k, v] of Object.entries(obj)) {
        if (k === '_ref' && typeof v === 'string' && v.length > 0) {
          dest.push(stripDraftId(v))
        }
        findRefs(v, dest)
      }
    } else if (Array.isArray(obj)) {
      for (const v of obj) {
        findRefs(v, dest)
      }
    }
  }
  return dest
}

function stripDraftId(id: string) {
  return id.replace(/^drafts\./, '')
}

function deduplicateDrafts(docs: SanityDocument[]) {
  const deduped: Record<string, SanityDocument> = {}
  for (const doc of docs) {
    if (!/^drafts\./.test(doc._id)) {
      deduped[doc._id] = doc
    }
  }
  for (const doc of docs) {
    if (/^drafts\./.test(doc._id)) {
      const id = stripDraftId(doc._id)
      deduped[id] = Object.assign(doc, {_id: id})
    }
  }
  return Object.values(deduped)
}

class Users {
  _users: any[] = []

  async getById(id: string, client: SanityClient) {
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
  id: string | null = null
  user: any = null
  doc: SanityDocument | null = null
  lastActive: number = 0
  startTime: number = 0
  angle: number = 0
}

class GraphData {
  sessions: Session[] = []
  data: any

  constructor(docs: SanityDocument[] = []) {
    const docsById: Record<string, SanityDocument> = {}
    for (const doc of docs) {
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
    let session = this.sessions.find((s) => s.user.id === user.id && s.doc?._id === docNode.doc._id)
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
    const copy = new GraphData()
    Object.assign(copy, this)
    copy.data = {
      nodes: [...this.data.nodes],
      links: [...this.data.links],
    }
    return copy
  }
}

const users = new Users()

interface GraphViewConfig {
  query?: string
  /** default: '2022-09-01' */
  apiVersion?: string
}

export function GraphView(props: GraphViewConfig) {
  const query = props.query || DEFAULT_QUERY
  const apiVersion = props.apiVersion ?? '2022-09-01'

  const userColorManager = useUserColorManager()
  const [maxSize, setMaxSize] = useState(0)
  const [hoverNode, setHoverNode] = useState<any>(null)
  const [documents, setDocuments] = useState<SanityDocument[]>([])
  const [docTypes, setDocTypes] = useState<Record<string, number>>({})
  const [graph, setGraph] = useState(() => new GraphData())
  const router = useRouter()
  const client = useClient({apiVersion})

  const fetchCallback = useCallback((_docs) => {
    const docs = deduplicateDrafts(_docs)
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

        const docsById: Record<string, SanityDocument> = {}
        for (const d of documents) {
          docsById[d._id] = d
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
          (id) => id === doc._id || docsById[id] !== null
        )
        const newRefs = findRefs(doc).filter((id) => id === doc._id || docsById[id] !== null)

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

        const user = await users.getById(update.identity, client)
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
    [documents, graph, client]
  )
  useFetchDocuments(query, fetchCallback, [], client)
  useListen(query, {}, {}, listenCallback, [documents, graph], client)
  useEffect(() => {
    const interval = setInterval(() => graph.reapSessions(), 1000)
    return () => clearInterval(interval)
  }, [graph])

  const theme = useTheme().sanity

  return (
    <GraphWrapper theme={theme}>
      <GraphRoot theme={theme}>
        <Legend theme={theme}>
          {getTopDocTypes(docTypes).map((docType) => (
            <LegendRow
              className={'legend__row'}
              key={docType}
              style={{color: getDocTypeColor(docType).fill}}
            >
              <LegendBadge theme={theme} />
              <div>{formatDocType(docType)}</div>
            </LegendRow>
          ))}
        </Legend>
        {hoverNode && <HoverNode theme={theme}>{labelFor(hoverNode.doc)}</HoverNode>}

        <ForceGraph2D
          graphData={graph.data}
          nodeAutoColorBy="group"
          enableNodeDrag={false}
          onNodeHover={(node: any) => setHoverNode(node)}
          onNodeClick={(node: any) => {
            router.navigateIntent('edit', {id: node.doc._id, documentType: node.doc._type})
          }}
          linkColor={() => rgba(gray[500].hex, 0.25)}
          nodeLabel={() => ''}
          nodeRelSize={1}
          nodeVal={(node: any) => valueFor(node.doc, maxSize)}
          onRenderFramePost={(ctx, globalScale) => {
            for (const session of graph.sessions) {
              const node = graph.data.nodes.find((n) => n.doc && n.doc._id === session?.doc?._id)
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
                  ctx.strokeStyle = rgba(white.hex, 1.0)
                  ctx.lineWidth = 2 / globalScale
                  ctx.moveTo(
                    node.x + (Math.sin(angle) * (distance - imgW / 2)) / globalScale,
                    node.y + (Math.cos(angle) * (distance - imgH / 2)) / globalScale
                  )
                  ctx.lineTo(node.x + Math.sin(angle) * radius, node.y + Math.cos(angle) * radius)
                  ctx.stroke()

                  ctx.beginPath()
                  ctx.strokeStyle = rgba(white.hex, 1.0)
                  ctx.lineWidth = 2 / globalScale
                  ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
                  ctx.stroke()

                  if (image) {
                    ctx.save()
                    // eslint-disable-next-line max-depth
                    try {
                      const dur = 700
                      const f = softEasing(
                        Math.max(0, (dur - (Date.now() - session.startTime)) / dur)
                      )
                      // eslint-disable-next-line max-depth
                      if (f > 0) {
                        ctx.beginPath()
                        ctx.fillStyle = rgba(userColor, f)
                        ctx.arc(x, y, (imgW / 2 + 10) / globalScale, 0, 2 * Math.PI, false)
                        ctx.fill()
                      }

                      ctx.beginPath()
                      ctx.fillStyle = rgba(white.hex, 1.0)
                      ctx.arc(x, y, imgW / globalScale / 2, 0, 2 * Math.PI, false)
                      ctx.clip()

                      ctx.drawImage(
                        image,
                        x - imgW / globalScale / 2,
                        y - imgH / globalScale / 2,
                        imgW / globalScale,
                        imgH / globalScale
                      )

                      ctx.strokeStyle = black.hex
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
                  ctx.strokeStyle = rgba(black.hex, 1)
                  ctx.lineWidth = 0.5 / globalScale
                  ctx.arc(x, y, imgW / globalScale / 2, 0, 2 * Math.PI, false)
                  ctx.stroke()

                  const above = angle >= Math.PI / 2 && angle < Math.PI * 1.5
                  const textY = above
                    ? y - (imgH / 2 + 5) / globalScale
                    : y + (imgH / 2 + 5) / globalScale
                  ctx.fillStyle = rgba(white.hex, 1.0)
                  ctx.textAlign = 'center'
                  ctx.textBaseline = above ? 'bottom' : 'top'
                  ctx.fillText(session.user.displayName, x, textY)
                } finally {
                  ctx.restore()
                }
              }
            }
          }}
          nodeCanvasObject={(node: any, ctx, globalScale) => {
            // eslint-disable-next-line default-case
            switch (node.type) {
              case 'document': {
                const nodeColor = getDocTypeColor(node.doc._type)
                const radius = Math.sqrt(valueFor(node.doc, maxSize))
                const fontSize = Math.min(100, 10.0 / globalScale)

                ctx.beginPath()
                ctx.fillStyle =
                  hoverNode !== null && node.doc._id === hoverNode.doc._id
                    ? rgba(gray[500].hex, 0.8)
                    : nodeColor.fill
                ctx.strokeStyle = nodeColor.border
                ctx.lineWidth = 0.5
                ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false)
                ctx.stroke()
                ctx.fill()

                if (radius * globalScale > 10) {
                  ctx.font = `${fontSize}px sans-serif`
                  const w = radius * 2 + 30 / globalScale
                  for (let len = 50; len >= 5; len /= 1.2) {
                    const label = truncate(labelFor(node.doc), Math.round(len))
                    const textMetrics = ctx.measureText(label)
                    if (textMetrics.width < w) {
                      // ctx.fillStyle = rgba(color.white.hex, 1.0)
                      ctx.textAlign = 'center'
                      ctx.textBaseline = 'top'

                      ctx.strokeStyle = rgba(black.hex, 0.5)
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
          linkCanvasObject={(link: any, ctx, globalScale) => {
            ctx.beginPath()
            ctx.strokeStyle = rgba(gray[500].hex, 0.125)
            ctx.lineWidth = 2 / globalScale
            ctx.moveTo(link.source.x, link.source.y)
            ctx.lineTo(link.target.x, link.target.y)
            ctx.stroke()
          }}
        />
      </GraphRoot>
    </GraphWrapper>
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
    fill: hues[hue][400].hex,
    border: rgba(black.hex, 0.5),
  }

  return colorCache[docType]
}
