// --- VARIABLES GLOBALES ---
let currentStudent = {};
let currentReclamation = {};
let capturedPhotos = [];
let videoStream = null;

// Annotation
let activePhotoIndex = null;
let activeProfIndex = null;
let isProfMode = false;
let isDrawing = false;

const canvasDraw = document.getElementById('drawing-canvas');
const ctxDraw = canvasDraw.getContext('2d');

// --- NAVIGATION ---
function goToPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(pageId).classList.add('active');

  // Arrêter la webcam si on quitte la page 3
  if (pageId !== 'page3' && videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
  }
}

document.getElementById('link-to-prof').addEventListener('click', () => goToPage('page4'));
document.getElementById('link-to-student').addEventListener('click', () => goToPage('page1'));
document.getElementById('btn-voir-mes-resultats').addEventListener('click', () => goToPage('page5'));

// --- PAGE 1: CONNEXION ÉTUDIANT ---
document.getElementById('form-login-etudiant').addEventListener('submit', function(e) {
  e.preventDefault();
  currentStudent = {
    nom: document.getElementById('login-nom').value,
    prenom: document.getElementById('login-prenom').value,
    filiere: document.getElementById('login-filiere').value,
    id: document.getElementById('login-id').value
  };

  document.getElementById('rec-nom').value = currentStudent.nom;
  document.getElementById('rec-prenom').value = currentStudent.prenom;
  document.getElementById('rec-filiere').value = currentStudent.filiere;
  document.getElementById('rec-id').value = currentStudent.id;

  goToPage('page2');
});

// --- PAGE 2: CHOIX MODULE ---
document.getElementById('form-reclamation').addEventListener('submit', function(e) {
  e.preventDefault();
  currentReclamation = {
    student: { ...currentStudent },
    module: document.getElementById('rec-module').value,
    professeur: document.getElementById('rec-prof').value,
    noteInitiale: document.getElementById('rec-note').value,
    noteFinale: null,
    statut: 'En attente'
  };

  capturedPhotos = [];
  renderGallery();
  goToPage('page3');
  initCamera();
});

// --- PAGE 3: CAMERA & GALERIE ---
async function initCamera() {
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
    document.getElementById('webcam').srcObject = videoStream;
  } catch (err) {
    alert("Erreur webcam : " + err.message);
  }
}

document.getElementById('btn-capture').addEventListener('click', function() {
  if (capturedPhotos.length >= 5) {
    alert("Maximum 5 photos autorisées.");
    return;
  }

  const video = document.getElementById('webcam');
  const canvas = document.getElementById('canvas');
  canvas.width = 640;
  canvas.height = 480;
  canvas.getContext('2d').drawImage(video, 0, 0, 640, 480);

  capturedPhotos.push(canvas.toDataURL('image/jpeg', 0.6));
  renderGallery();
});

function renderGallery() {
  const container = document.getElementById('gallery-container');
  document.getElementById('photo-count').textContent = capturedPhotos.length;
  container.innerHTML = '';

  capturedPhotos.forEach((imgSrc, idx) => {
    const div = document.createElement('div');
    div.className = 'gallery-item';
    div.innerHTML = `
      <img src="${imgSrc}" onclick="openAnnotation(${idx}, false)" title="Cliquez pour entourer l'erreur">
      <button class="delete-btn" onclick="removePhoto(${idx})">×</button>
    `;
    container.appendChild(div);
  });
}

function removePhoto(idx) {
  capturedPhotos.splice(idx, 1);
  renderGallery();
}

// ENVOI RÉCLAMATION
document.getElementById('btn-envoyer-reclamation').addEventListener('click', function() {
  const explication = document.getElementById('rec-explication').value;
  if (capturedPhotos.length === 0) return alert("Prenez au moins une photo.");
  if (!explication.trim()) return alert("Expliquez l'erreur.");

  currentReclamation.photos = capturedPhotos;
  currentReclamation.explication = explication;

  let list = JSON.parse(localStorage.getItem('reclamations') || '[]');
  list.push(currentReclamation);
  localStorage.setItem('reclamations', JSON.stringify(list));

  alert("Réclamation envoyée ! Notez votre ID : " + currentStudent.id);
  document.getElementById('rec-explication').value = '';
  goToPage('page1');
});

// --- PAGE 4: ESPACE ENSEIGNANT ---
document.getElementById('form-prof-login').addEventListener('submit', function(e) {
  e.preventDefault();
  document.getElementById('form-prof-login').style.display = 'none';
  document.getElementById('prof-dashboard').style.display = 'block';
  loadProfData();
});

function loadProfData() {
  const container = document.getElementById('reclamation-container');
  const moduleName = document.getElementById('prof-module').value;
  let list = JSON.parse(localStorage.getItem('reclamations') || '[]');

  let filtered = list.map((item, originalIndex) => ({ ...item, originalIndex }))
                     .filter(r => r.module === moduleName);

  container.innerHTML = '';

  if (filtered.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted); margin-top:10px;">Aucune réclamation pour ce module.</p>';
    return;
  }

  filtered.forEach(item => {
    let imgsHTML = item.photos.map((p, i) => 
      `<img src="${p}" onclick="openAnnotation(${i}, true, ${item.originalIndex})" style="width:60px; height:60px; object-fit:cover; border-radius:4px; margin-right:5px; cursor:pointer;" title="Cliquez pour corriger/dessiner">`
    ).join('');

    const card = document.createElement('div');
    card.className = 'card-result';
    card.innerHTML = `
      <span class="badge ${item.statut === 'Traité' ? 'badge-traite' : 'badge-attente'}">${item.statut}</span>
      <p style="margin-top:8px;"><strong>Étudiant :</strong> ${item.student.nom} ${item.student.prenom} (ID: ${item.student.id})</p>
      <p><strong>Note initiale :</strong> ${item.noteInitiale}/20</p>
      <p><strong>Explication :</strong> ${item.explication}</p>
      <p style="margin-top:5px;"><strong>Copie(s) :</strong></p>
      <div>${imgsHTML}</div>

      <div style="margin-top:10px; background:#fff; padding:10px; border-radius:6px; border:1px solid var(--border);">
        <label>Nouvelle note :</label>
        <input type="number" id="note-input-${item.originalIndex}" value="${item.noteFinale || item.noteInitiale}" min="0" max="20" step="0.25">
        <button class="btn-success" onclick="validerNote(${item.originalIndex})">Valider la note</button>
      </div>
    `;
    container.appendChild(card);
  });
}

function validerNote(index) {
  let list = JSON.parse(localStorage.getItem('reclamations') || '[]');
  const val = document.getElementById(`note-input-${index}`).value;
  list[index].noteFinale = val;
  list[index].statut = 'Traité';
  localStorage.setItem('reclamations', JSON.stringify(list));
  alert("Note mise à jour avec succès !");
  loadProfData();
}

// --- PAGE 5: RÉSULTATS ÉTUDIANT ---
// --- PAGE 5: RÉSULTATS ÉTUDIANT ---
document.getElementById('btn-chercher-reclamations').addEventListener('click', function() {
  const searchId = document.getElementById('search-id').value.trim();
  const container = document.getElementById('etudiant-results-container');

  if (!searchId) {
    alert("Veuillez saisir votre Code ID !");
    return;
  }

  let list = JSON.parse(localStorage.getItem('reclamations') || '[]');
  let mesRecs = list.filter(r => r.student && r.student.id && r.student.id.toLowerCase() === searchId.toLowerCase());

  container.innerHTML = '';

  if (mesRecs.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding: 15px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 8px; margin-top: 15px;">
        <p style="color: #e11d48; font-weight: bold;">Aucune réclamation trouvée pour l'ID : "${searchId}"</p>
        <p style="font-size: 0.85rem; color: #64748b; margin-top: 5px;">Vérifiez que vous avez bien envoyé une réclamation avec cet ID exact.</p>
      </div>
    `;
    return;
  }

  // Si on trouve des résultats, on génère les cartes
  mesRecs.forEach(rec => {
    const isTraite = rec.statut === 'Traité';
    let imgsHTML = rec.photos ? rec.photos.map(p => `<img src="${p}" onclick="window.open('${p}')" style="width:60px; height:60px; object-fit:cover; border-radius:4px; margin-right:5px; cursor:pointer;" title="Cliquer pour agrandir">`).join('') : '';

    const card = document.createElement('div');
    card.className = 'card-result';
    card.style.marginTop = '15px';
    card.innerHTML = `
      <span class="badge ${isTraite ? 'badge-traite' : 'badge-attente'}">Statut : ${rec.statut}</span>
      <p style="margin-top:8px;"><strong>Module :</strong> ${rec.module} (${rec.professeur})</p>
      <p><strong>Note initiale :</strong> ${rec.noteInitiale}/20</p>
      
      <div style="margin:10px 0; padding:10px; border-radius:6px; background:${isTraite ? '#f0fdf4' : '#fff8f1'}; border:1px solid ${isTraite ? '#86efac' : '#fed7aa'};">
        ${isTraite 
          ? `<h3 style="color:#15803d; margin:0;"> Note révisée : ${rec.noteFinale}/20</h3>` 
          : `<p style="color:#c2410c; margin:0;"> En cours d'examen par le professeur...</p>`
        }
      </div>

      <p style="margin-bottom: 5px;"><strong>Copie(s) envoyée(s) :</strong></p>
      <div>${imgsHTML}</div>
    `;
    container.appendChild(card);
  });
});