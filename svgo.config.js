// svgo.config.js
module.exports = {
    multipass: true,
    js2svg: {
        indent: 4,
        pretty: true,
    },
    plugins: ['preset-default', 'prefixIds', 'sortAttrs'],
}
