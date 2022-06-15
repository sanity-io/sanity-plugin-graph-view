import {useEffect} from 'react'
import {useClient} from 'sanity'
import {ListenEvent, ListenOptions} from '@sanity/client'

export function useListen(
  query: string,
  params: {[key: string]: any},
  options: ListenOptions,
  onUpdate: (event: ListenEvent<any>) => void,
  dependencies: unknown[]
): void {
  const client = useClient()
  useEffect(() => {
    const subscription = client.listen(query, params, options).subscribe((update) => {
      onUpdate(update)
    })
    return () => {
      subscription.unsubscribe()
    }
  }, dependencies)
}

export function useFetchDocuments(
  query: string,
  onFetch: (event: ListenEvent<any>) => void,
  dependencies: unknown[]
): void {
  const client = useClient()
  useEffect(() => {
    client.fetch(query).then((result) => {
      onFetch(result)
    })
  }, dependencies)
}
