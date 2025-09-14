// src/components/Modal.jsx
import React from "react";
import ReactDOM from "react-dom";

export default function Modal({ open, onClose, title, children }) {
  if (!open) return null;

  return ReactDOM.createPortal(
    <div style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {title && <h2 style={styles.title}>{title}</h2>}
        <div style={styles.content}>{children}</div>
        <div style={styles.footer}>
          <button style={styles.button} onClick={onClose}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100vw",
    height: "100vh",
    backgroundColor: "rgba(0,0,0,0.5)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  modal: {
    backgroundColor: "#fff",
    borderRadius: "8px",
    padding: "20px",
    maxWidth: "500px",
    width: "90%",
    boxShadow: "0 4px 15px rgba(0,0,0,0.3)",
  },
  title: {
    marginTop: 0,
    fontSize: "20px",
    textAlign: "center",
  },
  content: {
    margin: "15px 0",
  },
  footer: {
    display: "flex",
    justifyContent: "center",
  },
  button: {
    padding: "8px 14px",
    border: "none",
    borderRadius: "5px",
    backgroundColor: "#007bff",
    color: "#fff",
    cursor: "pointer",
  },
};
