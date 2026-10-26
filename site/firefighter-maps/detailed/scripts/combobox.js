// A search box with suggestions as you type (an ARIA combobox) -- used for the place search (search.js).
// wait for a pause in typing, so there's one request per word rather than per keystroke
const DEBOUNCE_MS = 250;

// Wires up a form's input and suggestion list. `search(query, signal)` resolves to the suggestions, `label(suggestion)` is the text shown for one, and `onChoose(suggestion)` is called with the one picked -- with the mouse, the keyboard, or Enter for the best match.
export const bindCombobox = ({
  form,
  input,
  list,
  search,
  label,
  onChoose,
}) => {
  let suggestions = [];
  let active = -1;
  let debounceTimer;
  let pending;

  // the suggestions for the query, cancelling any search still running
  const fetchSuggestions = (query) => {
    pending?.abort();
    pending = new AbortController();
    return search(query, pending.signal);
  };

  const setActive = (index) => {
    active = index;
    [...list.children].forEach((item, i) =>
      item.setAttribute("aria-selected", i === active),
    );
    if (active >= 0) {
      input.setAttribute("aria-activedescendant", list.children[active].id);
    } else {
      input.removeAttribute("aria-activedescendant");
    }
  };

  const close = () => {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    setActive(-1);
  };

  const show = (results) => {
    suggestions = results;
    list.replaceChildren(
      ...results.map((result, i) => {
        const item = document.createElement("li");
        item.id = `${list.id}-${i}`;
        item.setAttribute("role", "option");
        item.textContent = label(result);
        // mousedown rather than click, so it lands before the input's blur closes the list
        item.addEventListener("mousedown", (e) => {
          e.preventDefault();
          choose(i);
        });
        return item;
      }),
    );
    list.hidden = results.length === 0;
    input.setAttribute("aria-expanded", String(!list.hidden));
    setActive(-1);
  };

  const choose = (index) => {
    const result = suggestions[index];
    input.value = label(result);
    close();
    onChoose(result);
  };

  const logError = (error) => {
    if (error.name !== "AbortError") console.error("Search failed:", error);
  };

  input.addEventListener("input", () => {
    clearTimeout(debounceTimer);
    const query = input.value.trim();
    if (!query) {
      pending?.abort();
      close();
      return;
    }
    debounceTimer = setTimeout(async () => {
      try {
        show(await fetchSuggestions(query));
      } catch (error) {
        logError(error);
      }
    }, DEBOUNCE_MS);
  });

  input.addEventListener("keydown", (e) => {
    if (list.hidden) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((active + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((active - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === "Escape") {
      // just the list, rather than also closing a dialog the box is in
      e.preventDefault();
      close();
    }
  });

  input.addEventListener("blur", close);

  // Enter: the highlighted suggestion, or else the best match for what's typed
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearTimeout(debounceTimer);
    if (active >= 0) {
      choose(active);
      return;
    }
    const query = input.value.trim();
    if (!query) return;
    close();
    try {
      const [best] = await fetchSuggestions(query);
      if (best) onChoose(best);
    } catch (error) {
      logError(error);
    }
  });
};
