## Running the site

1. [Install Quarto.](https://quarto.org/docs/get-started/)
1. Start the server.

   ```sh
   quarto preview analysis
   ```

## Testing

```sh
uv run pytest
```

[Debugging in VSCode](https://code.visualstudio.com/docs/python/debugging) is supported.

The [firefighter map](analysis/firefighter-map/)'s JavaScript has its own tests, in [`tests/firefighter-map/`](tests/firefighter-map/):

```sh
cd tests/firefighter-map
npm install
npm test
```
