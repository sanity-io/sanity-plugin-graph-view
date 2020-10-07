import {useEffect} from 'react'
import client from 'part:@sanity/base/client'

export function useListen(query, params, options, onUpdate, dependencies) {
  useEffect(() => {
    const subscription = client.listen(query, params, options).subscribe((update) => {
      onUpdate(update)
    })

    return () => {
      subscription.unsubscribe()
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}

export function useFetchDocuments(query, onFetch, dependencies) {
  useEffect(() => {
    client.fetch(query).then((result) => {
      onFetch(result)
    })

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies)
}
