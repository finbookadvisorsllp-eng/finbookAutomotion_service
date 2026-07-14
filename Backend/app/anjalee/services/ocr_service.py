import time
import cv2
import fitz  # PyMuPDF
import numpy as np
from paddleocr import PaddleOCR
import logging
import threading
import concurrent.futures

logger = logging.getLogger("ocr_service")

# Concurrency lock to prevent concurrent OCR engine calls crashing PaddlePaddle
ocr_lock = threading.Lock()

class OcrService:
    _ocr_instance = None

    @classmethod
    def get_ocr_engine(cls):
        """Lazy initialization of PaddleOCR instance as a singleton."""
        if cls._ocr_instance is None:
            logger.info("Initializing PaddleOCR engine...")
            try:
                # use_angle_cls=True automatically handles orientation rotation (0, 90, 180, 270 degrees)
                cls._ocr_instance = PaddleOCR(use_angle_cls=True, lang='en', enable_mkldnn=False)
                logger.info("PaddleOCR engine initialized successfully.")
            except Exception as e:
                logger.error(f"Failed to initialize PaddleOCR engine: {e}")
                raise
        return cls._ocr_instance

    def pdf_to_images(self, file_path: str, dpi: int = 200) -> list:
        """Converts all pages of a PDF file into high-res images."""
        images = []
        doc = fitz.open(file_path)
        for page_num in range(len(doc)):
            page = doc.load_page(page_num)
            zoom = dpi / 72  # 72 is standard PDF resolution
            mat = fitz.Matrix(zoom, zoom)
            pix = page.get_pixmap(matrix=mat)
            
            # Read bytes into numpy array
            img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
            
            # Normalize channel count to 3 (BGR)
            if pix.n == 4:
                img_data = cv2.cvtColor(img_data, cv2.COLOR_BGRA2BGR)
            elif pix.n == 1:
                img_data = cv2.cvtColor(img_data, cv2.COLOR_GRAY2BGR)
            else:
                img_data = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
                
            images.append((page_num + 1, img_data))
        doc.close()
        return images

    def deskew(self, image: np.ndarray) -> np.ndarray:
        """Corrects small rotational skew in documents."""
        try:
            gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            gray = cv2.bitwise_not(gray)
            thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY | cv2.THRESH_OTSU)[1]
            coords = np.column_stack(np.where(thresh > 0))
            
            if coords.size == 0:
                return image

            angle = cv2.minAreaRect(coords)[-1]
            if angle < -45:
                angle = -(90 + angle)
            else:
                angle = -angle
            
            # Deskew only if angle is between 0.5 and 15 degrees to prevent false rotations
            if 0.5 < abs(angle) < 15:
                (h, w) = image.shape[:2]
                center = (w // 2, h // 2)
                M = cv2.getRotationMatrix2D(center, angle, 1.0)
                rotated = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
                return rotated
        except Exception as e:
            logger.warning(f"Deskewing failed: {e}")
        return image

    def enhance_contrast(self, image: np.ndarray) -> np.ndarray:
        """Applies adaptive contrast enhancement using CLAHE in LAB color space."""
        try:
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
            l, a, b = cv2.split(lab)
            l_enhanced = clahe.apply(l)
            enhanced_lab = cv2.merge((l_enhanced, a, b))
            return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
        except Exception as e:
            logger.warning(f"Contrast enhancement failed: {e}")
        return image

    def preprocess_image(self, img_bgr: np.ndarray) -> np.ndarray:
        """
        Full preprocessing pipeline for invoice/receipt photos:
        1. Upscale small images so text is larger and cleaner for OCR
        2. Denoise (remove WhatsApp/camera JPEG compression noise)
        3. Sharpen text edges with unsharp mask
        4. Adaptive contrast enhancement (CLAHE) for faded/dark regions
        5. Deskew to correct rotational tilt
        """
        try:
            h, w = img_bgr.shape[:2]

            # Step 1 — Upscale if image is too small (min 1500px wide for good OCR)
            target_min_width = 1500
            if w < target_min_width:
                scale = target_min_width / w
                new_w = int(w * scale)
                new_h = int(h * scale)
                img_bgr = cv2.resize(img_bgr, (new_w, new_h), interpolation=cv2.INTER_CUBIC)
                logger.debug(f"Upscaled image from {w}x{h} to {new_w}x{new_h}")

            # Step 2 — Denoise (bilateral filtering is extremely fast and preserves sharp text edges)
            img_bgr = cv2.bilateralFilter(img_bgr, d=5, sigmaColor=50, sigmaSpace=50)

            # Step 3 — Unsharp mask to sharpen text edges
            blurred = cv2.GaussianBlur(img_bgr, (0, 0), sigmaX=1.5)
            img_bgr = cv2.addWeighted(img_bgr, 1.5, blurred, -0.5, 0)

            # Step 4 — Adaptive contrast enhancement (CLAHE)
            img_bgr = self.enhance_contrast(img_bgr)

            # Step 5 — Deskew
            img_bgr = self.deskew(img_bgr)

        except Exception as e:
            logger.warning(f"preprocess_image pipeline error: {e}. Using original image.")

        return img_bgr


    def process_page_worker(self, page_number: int, img_bgr: np.ndarray) -> dict:
        """Preprocesses and runs OCR on a single page."""
        preprocessed = self.preprocess_image(img_bgr)
        img_rgb = cv2.cvtColor(preprocessed, cv2.COLOR_BGR2RGB)

        # Thread-safe model invocation
        with ocr_lock:
            ocr = self.get_ocr_engine()
            result = ocr.ocr(img_rgb)

        extracted_text = []
        words = []
        confidences = []

        if result and result[0]:
            page_data = result[0]
            # Handle both standard dictionary results (PaddleX / latest) and list-of-lists results (legacy)
            if isinstance(page_data, dict) or hasattr(page_data, "keys"):
                rec_texts = page_data.get("rec_texts", [])
                rec_scores = page_data.get("rec_scores", [])
                dt_polys = page_data.get("dt_polys", [])
                for idx, text in enumerate(rec_texts):
                    confidence = float(rec_scores[idx]) if idx < len(rec_scores) else 1.0
                    box = dt_polys[idx] if idx < len(dt_polys) else [[0, 0], [0, 0], [0, 0], [0, 0]]
                    if hasattr(box, "tolist"):
                        box_list = box.tolist()
                    else:
                        box_list = list(box)

                    extracted_text.append(text)
                    words.append({
                        "text": text,
                        "confidence": round(confidence, 4),
                        "box": [[int(coord[0]), int(coord[1])] for coord in box_list]
                    })
                    confidences.append(confidence)
            else:
                for line in page_data:
                    if not isinstance(line, (list, tuple)) or len(line) < 2:
                        continue
                    box = line[0]
                    text_info = line[1]
                    if not isinstance(text_info, (list, tuple)) or len(text_info) < 2:
                        continue
                    text = text_info[0]
                    confidence = float(text_info[1])

                    extracted_text.append(text)
                    words.append({
                        "text": text,
                        "confidence": round(confidence, 4),
                        "box": [[int(coord[0]), int(coord[1])] for coord in box]
                    })
                    confidences.append(confidence)

        avg_confidence = round(float(np.mean(confidences)), 4) if confidences else 0.0
        full_paragraph = "\n".join(extracted_text)

        return {
            "page_number": page_number,
            "text": full_paragraph,
            "confidence": avg_confidence,
            "words": words
        }

    def process_document(self, file_path: str, file_type: str) -> dict:
        """Reads a document, processes all pages (converting PDF to images if needed), and returns full OCR details."""
        start_time = time.time()
        pages_data = []

        try:
            if file_type == 'pdf':
                pages = self.pdf_to_images(file_path)
                if not pages:
                    raise ValueError("The PDF document contains zero pages or is corrupted.")

                # Parallel page preprocessing (FastAPI runs in async loop, we offload to thread pool)
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    futures = {executor.submit(self.process_page_worker, p_num, img): p_num for p_num, img in pages}
                    for future in concurrent.futures.as_completed(futures):
                        p_num = futures[future]
                        try:
                            page_result = future.result()
                            pages_data.append(page_result)
                        except Exception as e:
                            logger.error(f"Error executing OCR on PDF page {p_num}: {e}")
                            pages_data.append({
                                "page_number": p_num,
                                "text": "",
                                "confidence": 0.0,
                                "words": []
                            })
                pages_data.sort(key=lambda x: x["page_number"])
            else:
                img_bgr = cv2.imread(file_path)
                if img_bgr is None:
                    raise ValueError("Failed to load or read the image file.")
                
                res = self.process_page_worker(1, img_bgr)
                pages_data.append(res)

        except Exception as e:
            logger.error(f"OCR Document process failed: {e}")
            raise

        processing_time = round(time.time() - start_time, 2)
        page_count = len(pages_data)
        
        # Calculate overall average confidence
        total_conf = sum(p["confidence"] for p in pages_data)
        avg_confidence = round(total_conf / page_count, 4) if page_count > 0 else 0.0

        return {
            "processing_time": processing_time,
            "page_count": page_count,
            "avg_confidence": avg_confidence,
            "pages": pages_data
        }
