import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import "./capture.css";

interface CapturePayload {
  imageDataUrl: string;
  imageWidth: number;
  imageHeight: number;
  scaleFactor: number;
  isPrimary: boolean;
}

interface Point {
  x: number;
  y: number;
}

const captureSurface = document.getElementById("captureSurface") as HTMLElement;
const captureImage = document.getElementById("captureImage") as HTMLImageElement;
const selection = document.getElementById("selection") as HTMLElement;
const selectionSize = document.getElementById("selectionSize") as HTMLElement;
const captureHint = document.getElementById("captureHint") as HTMLElement;
const captureBusy = document.getElementById("captureBusy") as HTMLElement;
const windowLabel = getCurrentWindow().label;

let startPoint: Point | null = null;
let activePointer: number | null = null;
let busy = false;
let payload: CapturePayload | null = null;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function pointerPoint(event: PointerEvent): Point {
  return {
    x: clamp(event.clientX, 0, window.innerWidth),
    y: clamp(event.clientY, 0, window.innerHeight),
  };
}

function selectionBounds(start: Point, end: Point) {
  const left = Math.min(start.x, end.x);
  const top = Math.min(start.y, end.y);
  return {
    left,
    top,
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

function renderSelection(end: Point): void {
  if (!startPoint || !payload) return;
  const bounds = selectionBounds(startPoint, end);
  selection.hidden = false;
  selection.style.left = `${bounds.left}px`;
  selection.style.top = `${bounds.top}px`;
  selection.style.width = `${bounds.width}px`;
  selection.style.height = `${bounds.height}px`;
  const pixelWidth = Math.round((bounds.width / window.innerWidth) * payload.imageWidth);
  const pixelHeight = Math.round((bounds.height / window.innerHeight) * payload.imageHeight);
  selectionSize.textContent = `${pixelWidth} × ${pixelHeight}`;
}

async function cancelCapture(): Promise<void> {
  if (busy) return;
  busy = true;
  try {
    await invoke("cancel_builtin_capture");
  } catch {
    busy = false;
  }
}

captureSurface.addEventListener("pointerdown", (event) => {
  if (busy || event.button !== 0 || !payload) return;
  event.preventDefault();
  activePointer = event.pointerId;
  startPoint = pointerPoint(event);
  captureSurface.setPointerCapture(event.pointerId);
  captureHint.classList.add("is-quiet");
  renderSelection(startPoint);
});

captureSurface.addEventListener("pointermove", (event) => {
  if (busy || activePointer !== event.pointerId || !startPoint) return;
  renderSelection(pointerPoint(event));
});

captureSurface.addEventListener("pointerup", (event) => {
  if (busy || activePointer !== event.pointerId || !startPoint || !payload) return;
  const end = pointerPoint(event);
  const bounds = selectionBounds(startPoint, end);
  activePointer = null;
  startPoint = null;
  if (bounds.width < 6 || bounds.height < 6) {
    selection.hidden = true;
    captureHint.classList.remove("is-quiet");
    return;
  }

  busy = true;
  captureBusy.hidden = false;
  captureHint.hidden = true;
  selection.classList.add("is-processing");
  void invoke("finish_builtin_capture", {
    label: windowLabel,
    x: bounds.left / window.innerWidth,
    y: bounds.top / window.innerHeight,
    width: bounds.width / window.innerWidth,
    height: bounds.height / window.innerHeight,
  }).catch(() => {
    busy = false;
    captureBusy.hidden = true;
    selection.classList.remove("is-processing");
    captureHint.hidden = false;
  });
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    void cancelCapture();
  }
});

window.addEventListener("contextmenu", (event) => {
  event.preventDefault();
  void cancelCapture();
});

void invoke<CapturePayload>("get_capture_payload")
  .then((value) => {
    payload = value;
    captureImage.src = value.imageDataUrl;
    document.documentElement.dataset.ready = "true";
  })
  .catch(() => {
    captureHint.innerHTML = "<strong>无法载入截图</strong><span>正在返回译栈</span>";
    window.setTimeout(() => void cancelCapture(), 800);
  });
