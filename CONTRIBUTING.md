## Running the site

1. [Install Quarto.](https://quarto.org/docs/get-started/)
1. Start the server.

   ```sh
   quarto preview site
   ```

## Testing

```sh
uv run pytest
```

[Debugging in VSCode](https://code.visualstudio.com/docs/python/debugging) is supported.

The [detailed firefighter map](site/firefighter-maps/detailed/)'s JavaScript has its own tests, in [`tests/firefighter-maps/detailed/`](tests/firefighter-maps/detailed/):

```sh
cd tests/firefighter-maps/detailed
npm install
npm test
```
