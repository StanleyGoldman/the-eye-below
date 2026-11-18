// Small DOM helpers.

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className = "", text = ""): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/** Attach a hover tooltip. Lines are separated by newlines. */
export function tip<T extends HTMLElement>(node: T, text: string): T {
  node.dataset["tip"] = text;
  return node;
}

export function clear(node: HTMLElement): void {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function button(label: string, onClick: () => void, className = "btn"): HTMLButtonElement {
  const b = el("button", className, label);
  b.type = "button";
  b.addEventListener("click", (e) => {
    e.preventDefault();
    b.blur();
    onClick();
  });
  return b;
}

export function show(node: HTMLElement, visible: boolean): void {
  node.hidden = !visible;
}

/** The tooltip box: one per page, follows the pointer over anything with data-tip. */
export function installTooltips(root: HTMLElement, scale: () => number): void {
  const box = el("div", "tooltip");
  box.hidden = true;
  root.appendChild(box);
  let current: HTMLElement | null = null;
  const place = (e: MouseEvent): void => {
    const rect = root.getBoundingClientRect();
    const k = scale();
    const x = (e.clientX - rect.left) / k;
    const y = (e.clientY - rect.top) / k;
    const w = box.offsetWidth;
    const h = box.offsetHeight;
    box.style.left = `${Math.max(2, Math.min(root.offsetWidth - w - 2, x + 12))}px`;
    box.style.top = `${Math.max(2, y + 16 + h > root.offsetHeight ? y - h - 8 : y + 16)}px`;
  };
  root.addEventListener("mousemove", (e) => {
    const target = (e.target as HTMLElement | null)?.closest<HTMLElement>("[data-tip]") ?? null;
    if (target !== current) {
      current = target;
      const text = target?.dataset["tip"] ?? "";
      box.hidden = !text;
      box.textContent = text;
    } else if (current) {
      // The text can change while the pointer rests on the element.
      const text = current.dataset["tip"] ?? "";
      if (box.textContent !== text) box.textContent = text;
    }
    if (!box.hidden) place(e);
  });
  root.addEventListener("mouseleave", () => {
    current = null;
    box.hidden = true;
  });
  root.addEventListener("mousedown", () => {
    current = null;
    box.hidden = true;
  });
}
