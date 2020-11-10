import {route} from 'part:@sanity/base/router'
import {GraphView} from './GraphView'
import {GraphViewIcon} from './GraphViewIcon'

export default {
  title: 'Graph',
  name: 'graph-your-content',
  router: route('/:selectedDocumentId'),
  icon: GraphViewIcon,
  component: GraphView,
}
