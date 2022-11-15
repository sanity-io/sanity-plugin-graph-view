import {useEffect} from 'react'
import {ListenEvent, ListenOptions, SanityClient} from '@sanity/client'

// eslint-disable-next-line max-params
export function useListen(
  query: string,
  params: {[key: string]: any},
  options: ListenOptions,
  onUpdate: (event: ListenEvent<any>) => void,
  dependencies: unknown[],
  client: SanityClient
): void {
  useEffect(() => {
    const subscription = client.listen(query, params, options).subscribe((update) => {
      onUpdate(update)
    })
    return () => {
      subscription.unsubscribe()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, client])
}

export function useFetchDocuments(
  query: string,
  onFetch: (event: ListenEvent<any>) => void,
  dependencies: unknown[],
  client: SanityClient
): void {
  useEffect(() => {
    client.fetch(query).then((result) => {
      onFetch(result)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencies, client])
}
