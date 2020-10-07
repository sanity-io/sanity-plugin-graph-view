import {useEffect} from 'react'
import client from 'part:@sanity/base/client'

export function useListen(query, params, options, onUpdate, dependencies) {
  useEffect(() => {
    const subscription = client.listen(query, params, options).subscribe(update => {
      onUpdate(update)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, dependencies)
}

export function useFetchDocuments(query, onFetch, dependencies) {
  useEffect(() => {
    client.fetch(query).then(result => {
      onFetch(result)
    })
  }, dependencies)
}
