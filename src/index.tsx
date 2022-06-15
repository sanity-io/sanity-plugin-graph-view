import {GraphView} from './tool/GraphView'
import {GraphViewIcon} from './tool/GraphViewIcon'
import {createPlugin} from 'sanity'
import {route} from 'sanity/_unstable'
import React from 'react'

interface GraphViewConfig {
  query?: string
}

export const contentGraphView = createPlugin<GraphViewConfig>((config: GraphViewConfig = {}) => {
  return {
    name: '@sanity/content-graph-view',

    tools: (prev) => {
      return [
        ...prev,
        {
          name: 'graph-your-content',
          title: 'Graph',
          icon: GraphViewIcon,
          component: function component() {
            return <GraphView {...config} />
          },
          router: route.create('/:selectedDocumentId'),
        },
      ]
    },
  }
})
