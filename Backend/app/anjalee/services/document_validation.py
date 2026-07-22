import os
import hashlib
import cv2
import fitz  # PyMuPDF
import numpy as np
import logging
from openai import OpenAI
from app.config import settings

logger = logging.getLogger("document_validation")

class DocumentValidationService:
    def __init__(self):
        self.max_size_mb = 15  # 15 MB limit
        if settings.NVIDIA_API_KEY:
            self.llm_client = OpenAI(
                base_url=settings.NVIDIA_BASE_URL,
                api_key=settings.NVIDIA_API_KEY
            )
            self.model = settings.LLM_MODEL
        else:
            self.llm_client = None

    def calculate_file_hash(self, file_path: str) -> str:
        """Generates SHA-256 hash of the file for duplicate detection."""
        sha256 = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(8192):
                sha256.update(chunk)
        return sha256.hexdigest()

    def validate_file_basic(self, file_path: str, orig_name: str) -> dict:
        """
        Validates file size, extension, empty files, corruption, and password protection.
        """
        if not os.path.exists(file_path):
            return {"valid": False, "reason": "File does not exist."}

        # Size check
        size_bytes = os.path.getsize(file_path)
        if size_bytes == 0:
            return {"valid": False, "reason": "Empty file (0 bytes)."}

        size_mb = size_bytes / (1024 * 1024)
        if size_mb > self.max_size_mb:
            return {"valid": False, "reason": f"File size ({size_mb:.2f} MB) exceeds maximum limit of {self.max_size_mb} MB."}

        ext = orig_name.split('.').pop().lower()
        if ext not in ["pdf", "png", "jpg", "jpeg"]:
            return {"valid": False, "reason": f"Unsupported file type: .{ext}"}

        # PDF specific validations
        if ext == "pdf":
            try:
                doc = fitz.open(file_path)
                if doc.is_encrypted:
                    doc.close()
                    return {"valid": False, "reason": "Password protected/encrypted PDF document."}
                if doc.page_count == 0:
                    doc.close()
                    return {"valid": False, "reason": "PDF document contains 0 pages."}
                doc.close()
            except Exception as e:
                logger.error(f"PDF corruption detected: {e}")
                return {"valid": False, "reason": f"Corrupted PDF file: {str(e)}"}
        else:
            # Image specific validations
            try:
                img = cv2.imread(file_path)
                if img is None or img.size == 0:
                    return {"valid": False, "reason": "Corrupted image file: failed to load pixel data."}
            except Exception as e:
                logger.error(f"Image corruption detected: {e}")
                return {"valid": False, "reason": f"Corrupted image file: {str(e)}"}

        return {"valid": True, "size": size_bytes}

    def analyze_page_images(self, file_path: str, is_pdf: bool) -> list:
        """Converts document pages to images for quality and page validation analysis."""
        images = []
        try:
            if is_pdf:
                doc = fitz.open(file_path)
                for page_num in range(len(doc)):
                    page = doc.load_page(page_num)
                    pix = page.get_pixmap(dpi=110)
                    img_data = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n)
                    if pix.n == 4:
                        img_data = cv2.cvtColor(img_data, cv2.COLOR_BGRA2BGR)
                    elif pix.n == 1:
                        img_data = cv2.cvtColor(img_data, cv2.COLOR_GRAY2BGR)
                    else:
                        img_data = cv2.cvtColor(img_data, cv2.COLOR_RGB2BGR)
                    images.append((page_num + 1, img_data))
                doc.close()
            else:
                img = cv2.imread(file_path)
                if img is not None:
                    images.append((1, img))
        except Exception as e:
            logger.error(f"Error loading page images: {e}")
        return images

    def check_quality_and_pages(self, file_path: str, is_pdf: bool) -> dict:
        """
        Runs quality checks, page validations, orientation detections, and AI assessment.
        """
        pages = self.analyze_page_images(file_path, is_pdf)
        if not pages:
            return {
                "quality": {"score": "Poor", "suggestions": ["Upload a better copy"]},
                "pages": {"blank_pages": [], "orientation": "Unknown", "mixed_orientation": False}
            }

        # Page validation metrics
        blank_pages = []
        orientations = []
        mixed_orientation = False
        is_blurred = False
        low_resolution = False
        brightness_list = []
        contrast_list = []

        total_pages = len(pages)

        for p_num, img in pages:
            h, w = img.shape[:2]
            
            # Resolution check
            if h < 800 or w < 800:
                low_resolution = True

            # Orientation check
            orientation = "Portrait" if h >= w else "Landscape"
            orientations.append(orientation)

            # Brightness and contrast
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            mean_brightness = float(np.mean(gray))
            std_contrast = float(np.std(gray))
            brightness_list.append(mean_brightness)
            contrast_list.append(std_contrast)

            # Blur detection (Laplacian variance)
            laplacian_var = cv2.Laplacian(gray, cv2.CV_64F).var()
            if laplacian_var < 80:  # standard threshold for document blurriness
                is_blurred = True

            # Blank page check (low standard deviation and mean extreme)
            if std_contrast < 12 and (mean_brightness > 240 or mean_brightness < 15):
                blank_pages.append(p_num)

        # Mixed orientation check
        if len(set(orientations)) > 1:
            mixed_orientation = True

        avg_brightness = float(np.mean(brightness_list)) if brightness_list else 127.0
        avg_contrast = float(np.mean(contrast_list)) if contrast_list else 50.0

        brightness_status = "Good"
        if avg_brightness > 230:
            brightness_status = "Low Contrast/Overexposed"
        elif avg_brightness < 40:
            brightness_status = "Too Dark/Underexposed"

        contrast_status = "Good"
        if avg_contrast < 20:
            contrast_status = "Low Contrast"

        # Formulate AI Document Quality Call
        suggestions = []
        quality_score = "Good"

        if is_blurred:
            suggestions.append("Improve Scan: document appears blurry.")
            quality_score = "Needs Review"
        if low_resolution:
            suggestions.append("Upload Better Copy: image resolution is low.")
            quality_score = "Needs Review"
        if mixed_orientation:
            suggestions.append("Rotate Image: mixed page orientations detected.")
        if blank_pages:
            suggestions.append(f"Blank Page: pages {blank_pages} appear blank.")
            quality_score = "Needs Review"

        # Call AI for advanced flags (Watermark, Handwriting, Cut Document, Shadows)
        ai_quality_data = self._get_ai_quality_assessment(avg_brightness, avg_contrast, is_blurred, total_pages)

        # Merge suggestions and determine score
        suggestions.extend(ai_quality_data.get("suggestions", []))
        
        # Determine final score precedence: Poor > Needs Review > Good > Excellent
        final_score = ai_quality_data.get("quality_score", quality_score)
        if quality_score == "Needs Review" and final_score not in ["Poor"]:
            final_score = "Needs Review"

        return {
            "quality": {
                "score": final_score,
                "suggestions": list(set(suggestions)) if suggestions else ["None — Document is in excellent quality."],
                "blur": bool(is_blurred),
                "noise": bool(avg_contrast < 15),
                "low_resolution": bool(low_resolution),
                "brightness": brightness_status,
                "contrast": contrast_status,
                "watermark": bool(ai_quality_data.get("watermark", False)),
                "printed_vs_handwritten": ai_quality_data.get("printed_vs_handwritten", "Printed"),
                "cut_document": bool(ai_quality_data.get("cut_document", False)),
                "shadow_detected": bool(ai_quality_data.get("shadow_detected", False))
            },
            "pages": {
                "total_pages": int(total_pages),
                "blank_pages": [int(p) for p in blank_pages],
                "mixed_orientation": bool(mixed_orientation),
                "wrong_page_order": bool(ai_quality_data.get("wrong_page_order", False)),
                "merged_pages": bool(ai_quality_data.get("merged_pages", False)),
                "split_pages": bool(ai_quality_data.get("split_pages", False))
            }
        }

    def _get_ai_quality_assessment(self, brightness: float, contrast: float, is_blurred: bool, page_count: int) -> dict:
        """Queries the LLM for qualitative properties (shadows, handwriting, etc.) based on stats."""
        if not self.llm_client:
            return {
                "quality_score": "Good",
                "watermark": False,
                "printed_vs_handwritten": "Printed",
                "cut_document": False,
                "shadow_detected": False,
                "suggestions": []
            }

        prompt = f"""You are a document quality assessment model.
Analyze the following document metadata and return flags and suggestions:
- Average Pixel Brightness (0-255): {brightness:.1f}
- Average Pixel Contrast/StdDev: {contrast:.1f}
- Blur Detected by CV2: {is_blurred}
- Page Count: {page_count}

Assess whether the document likely contains shadows, watermarks, handwritten text vs printed, or cut content.
Output ONLY a valid JSON object:
{{
  "quality_score": "Excellent" | "Good" | "Needs Review" | "Poor",
  "watermark": true | false,
  "printed_vs_handwritten": "Printed" | "Handwritten" | "Mixed",
  "cut_document": true | false,
  "shadow_detected": true | false,
  "wrong_page_order": true | false,
  "merged_pages": true | false,
  "split_pages": true | false,
  "suggestions": ["suggestion 1", "suggestion 2"]
}}"""

        try:
            completion = self.llm_client.chat.completions.create(
                model=self.model,
                messages=[{"role": "user", "content": prompt}],
                temperature=0.0,
                max_tokens=250
            )
            raw = completion.choices[0].message.content.strip()
            # clean json
            if "```" in raw:
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
            import json
            return json.loads(raw.strip())
        except Exception as e:
            logger.error(f"Failed to fetch AI quality assessment: {e}")
            return {}

# Singleton
document_validation_service = DocumentValidationService()
