> **NOTE**
>
> This is the **Sanity Studio v3 version** of sanity-plugin-graph-view.
>
> For the v2 version, please refer to the [v2-branch](https://github.com/sanity-io/sanity-plugin-graph-view).

<div align="center">
  <img src="assets/sanity-logo.png" width="177" alt="Sanity" />
  <h1>Graph View Plugin</h1>
  <p>A tool for Sanity Studio to graph your content and see changes in real-time.</p>
  <p><img src="assets/screengrab.gif" width="540" alt="Screengrab of the Graph tool" /></p>
</div>

Wonder how a visualization of your dataset will look? How many authors do you have? How many items have they worked on? And are currently working on! Edits and changes are shown in real-time!

**Explore your data with this plugin, seek out strange corners and data types, boldly go where you could not before!**

## Installation 


`npm install --save sanity-plugin-graph-view@studio-v3`

or

`yarn add sanity-plugin-graph-view@studio-v3`


## Usage

Add it as a plugin in sanity.config.ts (or .js):

```js
import { contentGraphView } from "sanity-plugin-graph-view";

export default createConfig({
  // ...
  plugins: [
    contentGraphView({}),
  ] 
})
```

This will add a /graph-your-content tools to the Sanity Studio, configured with this default query:
```
  *[
    !(_id in path("_.*")) &&
    !(_type match "system.*") &&
    !(_type match "sanity.*")
  ]
````

## Configuration

You can control which documents appear in the graph by providing a query:

```js
import { contentGraphView } from "sanity-plugin-graph-view";

export default createConfig({
  // ...
  plugins: [
    contentGraphView({
      "query": "*[_type in ['a', 'b']]"
    }),
  ] 
})
```

For references to turn into graph edges, the entire document must be fetched, 
but you can also selectively filter what references will be included. For example:

```js
contentGraphView({
  "query": "*[_type in ['a', 'b']]{ 'refs': [author, publisher] }"
})
```

By default, the plugin uses `doc.title || doc.name || doc._id` as the node label.

If you want to use another property, compute a `title` property in your query, e.g.:


```js
contentGraphView({
  "query": "*[_type in ['a', 'b']] { ..., \"title\": select(_type == 'a' => 'Title A', _type == 'b' => 'Title B') }"
})
```

## Get help in the Sanity Community

[![Slack Community Button](https://slack.sanity.io/badge.svg)](https://slack.sanity.io/)

Join [Sanity’s developer community](https://slack.sanity.io) or ping us [on twitter](https://twitter.com/sanity_io).

## License

MIT © [Sanity.io](https://www.sanity.io/)

## Develop & test

This plugin uses [@sanity/plugin-kit](https://github.com/sanity-io/plugin-kit)
with default configuration for build & watch scripts.

See [Testing a plugin in Sanity Studio](https://github.com/sanity-io/plugin-kit#testing-a-plugin-in-sanity-studio)
on how to run this plugin with hotreload in the studio.

### Release new version

Run ["CI & Release" workflow](https://github.com/sanity-io/sanity-plugin-graph-view/actions/workflows/main.yml).
Make sure to select the v3 branch and check "Release new version".

Semantic release will only release on configured branches, so it is safe to run release on any branch.
