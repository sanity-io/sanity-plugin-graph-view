<div align="center">
  <img src="assets/sanity-logo.png" width="177" alt="Sanity" />
  <h1>Graph View Plugin</h1>
  <p>A tool for Sanity Studio to graph your content and see changes in real-time.</p>
  <p><img src="assets/screengrab.gif" width="540" alt="Screengrab of the Graph tool" /></p>
</div>

Wonder how a visualization of your dataset will look? How many authors do you have? How many items have they worked on? And are currently working on! Edits and changes are shown in real-time!

**Explore your data with this plugin, seek out strange corners and data types, boldly go where you could not before!**

```sh
# In your Sanity Studio repository:
sanity install graph-view

# Start the Studio
sanity start
```

## Configuration

Edit `./config/graph-view.json`:

```json
{
  "query": "*[_type == 'a' || _type == 'b']"
}
```

For references to turn into graph edges, the entire document must be fetched, but you can also selectively filter what references will be included. For example:

```json
{
  "query": "*[_type == 'a' || _type == 'b']{ 'refs': [author._ref, publisher._ref] }"
}
```

## Contributing

If you want to take part in developing this plugin, then look for planned features in the [list of issues](https://github.com/sanity-io/sanity-plugin-graph-view/issues) and reach out to us in the [Sanity Community](https://slack.sanity.io/).

```sh
git clone git@github.com:sanity-io/sanity-plugin-graph-view.git
cd sanity-plugin-graph-view
yarn
yarn link

# In a development Studio directory:
yarn link sanity-plugin-graph-view

# Lint your code before committing
yarn lint
```

## Get help in the Sanity Community

[![Slack Community Button](https://slack.sanity.io/badge.svg)](https://slack.sanity.io/)

Join [Sanity’s developer community](https://slack.sanity.io) or ping us [on twitter](https://twitter.com/sanity_io).

## License

MIT © [Sanity.io](https://www.sanity.io/)
