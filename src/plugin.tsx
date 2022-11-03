import {GraphView} from './tool/GraphView'
import {GraphViewIcon} from './tool/GraphViewIcon'
import {definePlugin} from 'sanity'
import {route} from 'sanity/router'
import React from 'react'

export interface GraphViewConfig {
  query?: string
}

export const contentGraphView = definePlugin<GraphViewConfig>((config: GraphViewConfig = {}) => {
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
