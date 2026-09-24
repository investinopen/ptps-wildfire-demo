-- Points relative links to files that aren't published on the site (other notebooks, SQL, etc.)
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

-- pages, plus files that are published as-is
local rendered = {}
for _, path in ipairs(config.project.render) do
  rendered[pandoc.utils.stringify(path)] = true
end
local resources = {}
for _, path in ipairs(config.project.resources) do
  table.insert(resources, pandoc.utils.stringify(path))
end

-- pandoc.path.normalize() leaves ".." segments in, e.g. from a page in a subfolder linking to a sibling folder
local function resolve_dots(path)
  local parts = {}
  for part in path:gmatch("[^/]+") do
    if part == ".." and #parts > 0 and parts[#parts] ~= ".." then
      table.remove(parts)
    elseif part ~= "." then
      table.insert(parts, part)
    end
  end
  return table.concat(parts, "/")
end

local function on_site(project_path)
  if rendered[project_path] then
    return true
  end
  for _, resource in ipairs(resources) do
    -- a link to a folder may or may not keep its trailing slash, depending on how it was written (e.g. "../detailed/" loses it)
    local folder = resource:gsub("/$", "")
    if project_path == folder or project_path:sub(1, #folder + 1) == folder .. "/" then
      return true
    end
  end
  return false
end

function Link(el)
  local path, fragment = el.target:match("^([^#]*)(.*)$")
  -- skip URLs, same-page anchors, and absolute paths
  if path == "" or path:match("^%a[%w+.-]*:") or path:match("^/") then
    return nil
  end

  local doc_dir = pandoc.path.directory(quarto.doc.input_file)
  local project_path = resolve_dots(pandoc.path.normalize(
    pandoc.path.make_relative(pandoc.path.join({ doc_dir, path }), quarto.project.directory)
  ))
  if on_site(project_path) then
    return nil
  end

  el.target = blob_url .. project_path .. fragment
  return el
end
