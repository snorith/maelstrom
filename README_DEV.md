# Development

Builds and then links output directory to the corresponding Foundry system folder

```shell
npm run build
```

Watchs for changes and rebuilds them

```shell
npm run build:watch
```

# Development Publishing

See: [Foundry Project Creator Wiki](https://gitlab.com/foundry-projects/foundry-pc/create-foundry-project/-/wikis/Publish) 

## Creating a published release

This will update the version number in package.json and system.json, 
updates the manifest and download links in system.json file and
pushes the release to the remote 

### publish, where the version number is automatically incremented according to what you provide below

```shell
node_modules/gulp/bin/gulp.js publish -u 0.1.3
```

### publish, but once you've already set a version, you can now have it increment automatically, by choosing one of:

```shell
node_modules/gulp/bin/gulp.js publish -u patch
node_modules/gulp/bin/gulp.js publish -u minor
node_modules/gulp/bin/gulp.js publish -u major
```
