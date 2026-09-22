-- Points relative links to files that aren't pages on the site (other notebooks, SQL, etc.)
-- at their GitHub blob URLs instead, so they show up rendered rather than downloading.
-- The source files keep their relative links, so they still work locally in Jupyter.

local config = pandoc.read(
  "---\n" .. io.open(pandoc.path.join({ quarto.project.directory, "_quarto.yml" })):read("a") .. "\n---\n",
  "markdown"
).meta
local website = config.website

local blob_url = table.concat({
  pandoc.utils.stringify(website["repo-url"]),
  "blob",
  pandoc.utils.stringify(website["repo-branch"]),
  pandoc.utils.stringify(website["repo-subdir"]),
}, "/") .. "/"

local rendered = {}
for _, path in ipairs(config.project.render) do
  rendered[pandoc.utils.stringify(path)] = true
end

function Link(el)
  local path, fragment = el.target:match("^([^#]*)(.*)$")
  -- skip URLs, same-page anchors, and absolute paths
  if path == "" or path:match("^%a[%w+.-]*:") or path:match("^/") then
    return nil
  end

  local doc_dir = pandoc.path.directory(quarto.doc.input_file)
  local project_path = pandoc.path.normalize(
    pandoc.path.make_relative(pandoc.path.join({ doc_dir, path }), quarto.project.directory)
  )
  if rendered[project_path] then
    return nil
  end

  el.target = blob_url .. project_path .. fragment
  return el
end
