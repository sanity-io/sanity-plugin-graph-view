import {route} from 'part:@sanity/base/router'
import {GraphTool} from './GraphTool'
import {GraphToolIcon} from './GraphToolIcon'

export default {
  title: 'Graph',
  name: 'graph-your-content',
  router: route('/:selectedDocumentId'),
  icon: GraphToolIcon,
  component: GraphTool,
}
