// Firebase
const firebaseConfig = {
  apiKey: 
  authDomain: "saturnusilmo.firebaseapp.com",
  projectId: "saturnusilmo",
  storageBucket: "saturnusilmo.firebasestorage.app",
  messagingSenderId: "1097247572697",
  appId: "",
  measurementId: 
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

const authArea = document.getElementById('auth-area');
const appArea = document.getElementById('app-area');
const slotsDiv = document.getElementById('slots');
const btnAdmin = document.getElementById('admin-reset');
const adminEmail = "alinater08@gmail.com";

const slotTimes = ["18:00", "18:30", "19:00", "19:30"];
const maxSlots = 10;

// REFRESH SLOTS
function refreshSlots() {
  slotsDiv.innerHTML = "";
  const u = auth.currentUser;

  db.collection('signups').where('email', '==', u.email).get()
    .then(userSnap => {
      let userSlot = null;
      let userDocId = null;
      if (!userSnap.empty) {
        const doc = userSnap.docs[0];
        userSlot = doc.data().slot;
        userDocId = doc.id;
      }

      slotTimes.forEach((t, i) => {
        db.collection('signups').where('slot', '==', i).get()
          .then(snap => {
            const count = snap.docs.reduce((sum, d) => sum + (d.data().amount || 1), 0);

            const div = document.createElement('div');

            if (userSlot === i) {
              div.innerHTML = `
                <p><strong>${t}</strong> – Olet ilmoittautunut tähän aikaan (${count}/${maxSlots})</p>
                <button onclick="cancelSignup('${userDocId}')">Peruuta ilmoittautuminen</button>
              `;
            } else {
              const select = document.createElement('select');
              for (let n = 1; n <= 10; n++) {
                const option = document.createElement('option');
                option.value = n;
                option.textContent = n;
                select.appendChild(option);
              }

              const btn = document.createElement('button');
              btn.textContent = `${t} (${count}/${maxSlots})`;
              btn.disabled = count >= maxSlots || userSlot !== null;
              btn.onclick = () => signup(i, parseInt(select.value));

              div.appendChild(select);
              div.appendChild(btn);
            }

            slotsDiv.appendChild(div);
          });
      });
    });
}

// SIGNUP TRANSACTIONILLA
function signup(i, amount) {
  const u = auth.currentUser;
  const slotRef = db.collection('signups').doc(); // uusi dokumentti

  db.runTransaction(async (t) => {
    // Tarkistetaan onko käyttäjä jo ilmoittautunut
    const userSnap = await db.collection('signups').where('email', '==', u.email).get();
    if (!userSnap.empty) {
      throw "Olet jo ilmoittautunut yhteen aikaan.";
    }

    // Lasketaan kuinka monta on jo valitussa slotissa
    const slotSnap = await db.collection('signups').where('slot', '==', i).get();
    const count = slotSnap.docs.reduce((sum, d) => sum + (d.data().amount || 1), 0);

    if (count + amount > maxSlots) {
      throw `Liikaa osallistujia valitussa slotissa. (${count}/${maxSlots})`;
    }

    // Lisätään uusi ilmoittautuminen transactionissa
    t.set(slotRef, { email: u.email, slot: i, amount: amount });

  }).then(() => {
    refreshSlots();
    loadMySignup();
  }).catch(err => alert(err));
}


// LOAD MY SIGNUP
function loadMySignup() {
  const u = auth.currentUser;
  const div = document.getElementById('my-slot');

  db.collection('signups')
    .where('email', '==', u.email)
    .get()
    .then(snapshot => {
      if (snapshot.empty) {
        div.innerHTML = 'Et ole vielä ilmoittautunut.';
        return;
      }

      const doc = snapshot.docs[0];
      const data = doc.data();

      const slotIndex = data.slot;
      const people = data.amount || 1;
      const aika = slotTimes[slotIndex];

      div.innerHTML = `
        <strong>Olet ilmoittautunut aikaan ${aika}</strong><br>
        Henkilömäärä: <strong>${people}</strong><br><br>
        <button onclick="cancelSignup('${doc.id}')">Peruuta ilmoittautuminen</button>
      `;
    });
}


// CANCEL SIGNUP
function cancelSignup(docId) {
  db.collection('signups').doc(docId).delete()
    .then(() => { alert("Ilmoittautuminen peruttu."); refreshSlots(); loadMySignup(); });
}

// LOGIN / REGISTER
document.getElementById("login-btn").onclick = () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value.trim();
  auth.signInWithEmailAndPassword(email,password).catch(e=>alert("Kirjautumisvirhe: "+e.message));
};

document.getElementById("register-btn").onclick = () => {
  const email = document.getElementById("register-email").value.trim();
  const password = document.getElementById("register-password").value.trim();
  auth.createUserWithEmailAndPassword(email,password).catch(e=>alert("Rekisteröintivirhe: "+e.message));
};

function logout() { auth.signOut(); }
document.getElementById('logout').onclick = logout;

function showLogin() { document.getElementById("login-view").style.display="block"; document.getElementById("register-view").style.display="none"; }
function showRegister() { document.getElementById("login-view").style.display="none"; document.getElementById("register-view").style.display="block"; }

function resetPassword() {
  const email = document.getElementById("login-email").value.trim();
  const msg = document.getElementById("auth-message");

  msg.style.display = "none";

  if (!email) {
    msg.textContent = "Syötä ensin sähköpostiosoite.";
    msg.className = "auth-error";
    msg.style.display = "block";
    return;
  }

  auth.sendPasswordResetEmail(email)
    .then(() => {
      msg.textContent = "Salasanan palautuslinkki lähetetty sähköpostiisi. Tarkista myös roskapostikansio.";
      msg.className = "auth-success";
      msg.style.display = "block";
    })
    .catch(err => {
      msg.textContent = err.message;
      msg.className = "auth-error";
      msg.style.display = "block";
    });
}


// ADMIN RESET
btnAdmin.onclick = () => {
  const u = auth.currentUser;
  if(u && u.email===adminEmail){
    db.collection('signups').get().then(snap=>{snap.forEach(doc=>db.collection('signups').doc(doc.id).delete());}).then(refreshSlots);
  } else { alert("Sinulla ei ole oikeutta nollata ilmoittautumisia."); }
};

// AUTH STATE
auth.onAuthStateChanged(u => {
  if(u){
    authArea.style.display='none';
    appArea.style.display='block';
    refreshSlots();
    document.getElementById("logout-link").style.display="block";
    document.getElementById("edit-date-area").style.display = u.email===adminEmail?'block':'none';
    btnAdmin.style.display = u.email===adminEmail?'block':'none';
    loadMySignup();
  } else {
    authArea.style.display='block';
    appArea.style.display='none';
    document.getElementById("logout-link").style.display="none";
    document.getElementById("edit-date-area").style.display='none';
    btnAdmin.style.display='none';
  }
});

// EVENT DATE
function loadEventDate() {
  db.collection("settings").doc("event").get()
    .then(doc => {
      const dateText = doc.exists ? doc.data().date : "Ei asetettu";
      document.getElementById("event-date").textContent = dateText;
      document.getElementById("otsikko-date").textContent = dateText;
    });
}
loadEventDate();

function saveNewDate() {
  const newDate = document.getElementById("new-date").value.trim();
  if(!newDate){alert("Syötä päivämäärä"); return;}
  db.collection("settings").doc("event").set({date:newDate})
    .then(()=>{alert("Päivämäärä päivitetty!"); loadEventDate(); document.getElementById("new-date").value="";});
}

function toggleSidebar(){document.getElementById("sidebar").classList.toggle("open");}

