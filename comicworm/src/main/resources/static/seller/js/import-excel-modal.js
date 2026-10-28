(() => {
  const modal = document.getElementById('importExcelModal');
  if (!modal) return;
  const fileInput = document.getElementById('excelFileInput');

  const openModal = () => {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
  };

  const closeModal = () => {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
  };

  document.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('#importExcelButton')) {
      openModal();
      fileInput?.click();
      return;
    }

    if (target.closest('#closeImportModalBtn, #cancelImportModalBtn') || target === modal) {
      closeModal();
    }
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('active')) {
      closeModal();
    }
  });
})();
