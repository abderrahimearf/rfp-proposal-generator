import fitz  
import os
from pathlib import Path

try:
    from docx import Document
except ImportError:
    Document = None
    print(" python-docx non installé. Installez avec: pip install python-docx")


def extract_text_from_pdf(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        page_info = []
        for page_num, page in enumerate(doc, 1):
            page_text = page.get_text()
            if page_text.strip():
                page_info.append((page_text, page_num))
        doc.close()
        return page_info
    except Exception as e:
        print(f" Erreur PDF {pdf_path}: {e}")
        return []


def extract_text_from_docx(docx_path):
    if not Document:
        print(" python-docx requis pour .docx")
        return []

    try:
        doc = Document(docx_path)
        page_info = []
        current_page = 1
        words_per_page = 400
        word_count = 0
        page_text = ""

        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                para_text = paragraph.text.strip() + "\n"
                para_words = len(para_text.split())

                if word_count + para_words > words_per_page and page_text:
                    page_info.append((page_text, current_page))
                    current_page += 1
                    page_text = para_text
                    word_count = para_words
                else:
                    page_text += para_text
                    word_count += para_words

        if page_text:
            page_info.append((page_text, current_page))

        return page_info
    except Exception as e:
        print(f" Erreur DOCX {docx_path}: {e}")
        return []


def split_text_with_pages(page_info, max_chars, overlap_chars):
    
    chunks_with_pages = []
    chunk_index = 1

    for page_text, page_num in page_info:
        text = page_text.replace('\n\n', '\n').strip()
        start = 0
        length = len(text)

        while start < length:
            end = min(start + max_chars, length)
            if end < length:
                last_space = text.rfind(' ', start, end)
                if last_space > start:
                    end = last_space
            chunk = text[start:end].strip()
            if chunk:
                chunks_with_pages.append({
                    "contenu": chunk,
                    "page": page_num,
                    "indexchunk": chunk_index
                })
                chunk_index += 1
            if end >= length:
                break
            start = end - overlap_chars if end - overlap_chars > start else end

    return chunks_with_pages


def process_file(file_path, max_chars=500, overlap_chars=50):
    
    file_path = str(Path(file_path).resolve())
    if not os.path.exists(file_path):
        print(f" Fichier non trouvé : {file_path}")
        return []

    ext = Path(file_path).suffix.lower()
    if ext == ".pdf":
        page_info = extract_text_from_pdf(file_path)
    elif ext == ".docx":
        page_info = extract_text_from_docx(file_path)
    else:
        print(f" Format non supporté : {ext}")
        return []

    if not page_info:
        print(" Aucune page traitable trouvée.")
        return []

    return split_text_with_pages(page_info, max_chars, overlap_chars)




