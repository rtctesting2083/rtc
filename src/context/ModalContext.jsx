import React, { createContext, useContext, useState, useCallback } from 'react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    title: '',
    content: null,
    size: 'normal', // 'normal' | 'wide' | 'xwide'
    closeOnBackdrop: false,
  });

  const openModal = useCallback((title, content, size = 'normal', options = {}) => {
    setModalState({
      isOpen: true,
      title,
      content,
      size,
      closeOnBackdrop: options?.closeOnBackdrop ?? false,
    });
  }, []);

  const closeModal = useCallback(() => {
    setModalState((prev) => ({ ...prev, isOpen: false, content: null }));
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {modalState.isOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget && modalState.closeOnBackdrop) {
              closeModal();
            }
          }}
        >
          <div
            className={`modal ${
              modalState.size === 'wide'
                ? 'modal-wide'
                : modalState.size === 'xwide'
                ? 'modal-xwide'
                : ''
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h2>{modalState.title}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={closeModal}
                aria-label="Close modal"
              >
                ✕
              </button>
            </div>
            <div className="modal-body">{modalState.content}</div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
}
