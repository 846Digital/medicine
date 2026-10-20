'use strict';

const config = window.INVITATION_CONFIG;
const cover = document.getElementById('cover');
const invitation = document.getElementById('invitation');
const openButton = document.getElementById('open-invitation');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
document.body.style.overflowY = 'hidden';
invitation.inert = true;

// The reference's stamp breathes continuously before the cover is opened.
// GSAP owns its transform; CSS hover/press feedback only changes opacity.
let coverAnimationMedia;
if (window.gsap) {
  coverAnimationMedia = gsap.matchMedia();
  coverAnimationMedia.add('(prefers-reduced-motion: no-preference)', () => {
    if (cover.hidden) return;
    gsap.to(openButton, {
      id: 'open-button-pulse', scale: 1.1, duration: 1,
      ease: 'sine.inOut', repeat: -1, yoyo: true,
    });
  });
}

function finishOpening() {
  coverAnimationMedia?.revert();
  cover.hidden = true;
  invitation.inert = false;
  document.body.style.overflowY = '';
  window.scrollTo({top: 0, behavior: 'instant'});
  document.getElementById('invitation-title').focus({preventScroll: true});
  setupAnimations();
}

openButton.addEventListener('click', () => {
  openButton.disabled = true;
  // The source switches from the cover to the invitation in one frame.
  finishOpening();
});

// Keep the modal's keyboard focus within the unopened medical file.
cover.addEventListener('keydown', event => {
  if (event.key === 'Tab') { event.preventDefault(); openButton.focus(); }
});
openButton.focus({preventScroll: true});

function setText(selector, value) {
  document.querySelectorAll(selector).forEach(element => {
    element.textContent = value;
  });
}
setText('[data-person="bride"]', config.bride);
setText('[data-person="groom"]', config.groom);
setText('[data-file-number]', config.fileNumber);
setText('[data-wedding-date]', config.date);
document.querySelector('[data-wedding-date]').dateTime = config.dateISO;
setText('[data-venue-name]', `«${config.venue}»`);
setText('[data-venue-type]', config.venueType);
setText('[data-address]', config.address);
document.title = `${config.groom} и ${config.bride} — приглашение на свадьбу`;
if (config.portraits !== 'assets/portraits.webp') {
  const photo = document.createElement('img');
  photo.src = config.portraits;
  photo.alt = '';
  photo.className = 'motion-layer';
  document.querySelector('.portraits').replaceChildren(photo);
}
const groomPhoto = document.querySelector('[data-groom-photo]');
if (groomPhoto) {
  const requestedVariant = new URLSearchParams(window.location.search).get('groom-photo');
  const variant = ['background', 'cutout'].includes(requestedVariant)
    ? requestedVariant : config.groomPhotoVariant;
  const source = variant === 'cutout' ? config.groomPhotoCutout : config.groomPhoto;
  if (source) groomPhoto.src = source;
  groomPhoto.closest('.portrait-man').dataset.photoVariant = variant;
}

document.querySelector('[data-closing-photo]').src = config.closingPhoto;

let animationMedia;
let invitationSmoother;
function setupAnimations() {
  if (!window.gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(ScrollTrigger);
  // Mobile browser bars must not restart scenes while a gesture is in progress.
  // Width changes (including orientation) still trigger a full refresh.
  ScrollTrigger.config({ignoreMobileResize: true});
  if (window.ScrollSmoother) gsap.registerPlugin(ScrollSmoother);
  animationMedia?.revert();
  animationMedia = gsap.matchMedia();
  animationMedia.add('(prefers-reduced-motion: no-preference)', () => {
    // Create the smoother before the scene triggers. They all read the same
    // rendered scroll position, including when the wheel changes direction.
    invitationSmoother = window.ScrollSmoother ? ScrollSmoother.create({
      wrapper: '#smooth-wrapper', content: '#smooth-content',
      smooth: .65, smoothTouch: .1,
    }) : null;
    const pageWidth = () => invitation.getBoundingClientRect().width;

    // One pulse at opening: 82 → 96 → 82 video pixels, over about 0.8s.
    gsap.to('.play-disc', {scale: 1.18, duration: .4, ease: 'sine.inOut', repeat: 1, yoyo: true});

    // The recording fades specific ink/images, not entire sections. In
    // particular, both underlines and the silver sample stay visible.
    function fade(selector, trigger, start, duration) {
      gsap.from(selector, {autoAlpha: 0, duration, ease: 'power3.out',
        scrollTrigger: {trigger, start: `top ${start}%`, once: true}});
    }
    gsap.from('.symptoms-list li', {autoAlpha: 0, duration: .58, stagger: .174, ease: 'power3.out',
      scrollTrigger: {trigger: '.symptoms-list', start: 'top 89.3%', once: true}});
    fade('.date-line > *', '.date-line', 86.4, .65);
    fade('.venue-name > *', '.venue-name', 87.2, .56);
    [[89.2,.64],[90,.6]].forEach(([start,duration],index) => {
      const selector = `.schedule-list li:nth-child(${index+1})`;
      fade(selector, selector, start, duration);
    });
    fade('.dress-palette', '.dress-palette', 96.2, .65);
    document.querySelectorAll('.outfits').forEach(strip => fade(strip, strip, 92, .6));
    // Frame-by-frame: the ink appears at a constant size, without a bounce.
    function inkStamp(id, selector, start, duration) {
      gsap.fromTo(selector, {autoAlpha: 0}, {
        id, autoAlpha: 1, duration, ease: 'power3.out',
        scrollTrigger: {trigger: selector, start: `top ${start}%`, once: true},
      });
    }
    inkStamp('diagnosis-ink', '.diagnosis-stamp', 48.3, .58);
    inkStamp('wedding-ink', '.wedding-stamp', 91.5, .75);

    // Frames use the reference's 720 x 1280 coordinates. Screen checkpoints
    // follow viewport height, just like the fades; artwork offsets follow the
    // invitation's width. The stationary scene supplies the scroll position.
    function scrollArtwork(id, selector, sceneSelector, anchor, frames, origin = '50% 50%') {
      const element = document.querySelector(selector);
      if (!element) return;
      const scene = document.querySelector(sceneSelector);
      const baseRotation = Number(gsap.getProperty(element, 'rotation')) || 0;
      // Let ScrollTrigger measure document coordinates. Adding native scrollY
      // to a transformed content rect would introduce a jump during refresh.
      const position = viewportY => `top+=${anchor * pageWidth() / 720} ${viewportY / 1280 * 100}%`;
      const values = frame => ({
        x: () => frame[1] * pageWidth() / 720,
        y: () => frame[2] * pageWidth() / 720,
        rotation: baseRotation + frame[3],
      });
      gsap.set(element, {transformOrigin: origin});
      const timeline = gsap.timeline({scrollTrigger: {
        id, trigger: scene, start: () => `clamp(${position(frames[0][0])})`,
        end: () => `clamp(${position(frames.at(-1)[0])})`, scrub: true, invalidateOnRefresh: true,
      }});
      timeline.fromTo(element, values(frames[0]), {...values(frames[1]), duration: frames[0][0]-frames[1][0], ease: 'none'});
      for (let i = 2; i < frames.length; i++) {
        timeline.to(element, {...values(frames[i]), duration: frames[i-1][0]-frames[i][0], ease: 'none'});
      }
    }

    // Both photos rotate around their upper inner corners. The clip stays put.
    scrollArtwork('portrait-man', '.portrait-man', '.portraits', 0,
      [[862,0,0,8.05],[307,0,0,0]], '45.947% -3.728%');
    scrollArtwork('portrait-woman', '.portrait-woman', '.portraits', 0,
      [[862,0,0,-8.05],[307,0,0,0]], '56.233% 4.717%');

    scrollArtwork('stethoscope-motion', '.stethoscope', '.stethoscope-scene', 191,
      [[1280,-3,140,6.75],[1071,-3,90,4.47],[985,-2.2,69.3,3.46],
       [931,-2.1,53.6,2.48],[865,-1.5,38.9,1.75],[805,-.8,23.3,1.14],
       [739,0,8.5,.5],[700,0,0,0]], '90.042% 50.263%');
    scrollArtwork('xray-motion', '.xray', '.xray-vial', 181,
      [[1280,-150,0,0],[680,0,0,0]]);
    scrollArtwork('vial-motion', '.love-vial', '.xray-vial', 158,
      [[1280,105,0,0],[1197,92.8,0,0],[1040,68.3,0,0],
       [873,39.8,0,0],[705,14.4,0,0],[600,0,0,0]]);
    scrollArtwork('roles-motion', '.medical-roles', '.roles-scene', 296,
      [[1800,345,40,0],[1352,188.8,21.9,0],[1251,153.2,18.3,0],
       [1170,123.6,14.6,0],[1095,102.8,11.1,0],[1010,71.2,7.3,0],
       [935,43.5,2.9,0],[882,24.6,2.4,0],[835,7.6,1.1,0],[813,0,0,0]]);
    scrollArtwork('rings-motion', '.rings', '.rings-scene', 102.5,
      [[1280,-144,0,0],[795,-59.9,0,0],[723,-46.9,0,0],
       [676,-38.8,0,0],[643,-32.7,0,0],[580,-23.9,0,0],
       [493,-7.7,0,0],[447.5,0,0,0],[364,10.6,0,0],[265,24.7,0,0]]);
    scrollArtwork('closing-motion', '.closing-photo', '.closing-scene', 338.5,
      [[1500,340,-46,-9.17],[1387,271.7,-37.1,-7.307],
       [1074,81.3,-10.6,-2.206],[982,22.8,-2.5,-.613],[945,0,0,0]], '50% 44.1%');
    // The ECG paper translates along its -11° angle as the page scrolls.
    // Grid and trace move together. There is no autonomous ticker in the video.
    gsap.fromTo('.ecg-track', {x: 0}, {
      x: () => -.48 * (innerHeight + document.querySelector('.ecg').getBoundingClientRect().height),
      ease: 'none',
      scrollTrigger: {id: 'ecg-motion', trigger: '.ecg', start: 'top bottom', end: 'bottom top', scrub: true, invalidateOnRefresh: true},
    });

    // The reference finishes the bag's drift at y=201.6 / 1280 (15.75%).
    // Keep its travel in artwork units, independent of the screen's aspect ratio.
    const ivDistance = () => (1280 - 201.6) * pageWidth() / 720;
    gsap.fromTo('[data-iv]', {
      x: () => ivDistance() * .111,
      y: () => -ivDistance() * .028,
    }, {
      x: 0, y: 0, ease: 'none',
      scrollTrigger: {id: 'iv-motion', trigger: '.iv-scene', start: 'clamp(top bottom)', end: 'clamp(top 15.75%)', scrub: true, invalidateOnRefresh: true},
    });

    // Measured blister positions include the small changes of slope near the
    // left edge. Direct scrub preserves both pauses and reverse scrolling.
    gsap.set('[data-pills]', {marginLeft: 0});
    scrollArtwork('pills-motion', '[data-pills]', '.pills-scene', 0,
      [[1280,538,0,0],[901,305,0,0],[723,202,0,0],[655,158,0,0],
       [650,153,0,0],[544,96,0,0],[423,24,0,0],[357,-16,0,0],
       [290,-58,0,0],[174,-121,0,0],[141,-137,0,0]]);
    return () => {
      invitationSmoother?.kill();
      invitationSmoother = null;
    };
  });
  // Only refresh when intrinsic layout settles; scrolling itself needs no layout reads.
  let refreshFrame;
  const refresh = () => {
    cancelAnimationFrame(refreshFrame);
    refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
  };
  document.querySelectorAll('img').forEach(image => {
    if (!image.complete) image.addEventListener('load', refresh, {once: true});
  });
  document.fonts.ready.then(refresh);
  refresh();
}

const musicButton = document.getElementById('music-button');
const musicLabel = document.getElementById('music-label');
let audioContext;
let master;
let timer;
let musicPlaying = false;
let externalAudio;

function setMusicState(playing) {
  musicPlaying = playing;
  musicButton.setAttribute('aria-pressed', String(playing));
  musicLabel.innerHTML = playing ? 'Выключить звук,<br>сохранить настроение' : 'Включи звук,<br>для настроения';
}

// A gentle original piano sketch, synthesized locally. No automatic playback.
function pianoNote(midi, at, duration, gain) {
  const frequency = 440 * 2 ** ((midi - 69) / 12);
  const envelope = audioContext.createGain();
  envelope.gain.setValueAtTime(0, at);
  envelope.gain.linearRampToValueAtTime(gain, at + .012);
  envelope.gain.exponentialRampToValueAtTime(.001, at + duration);
  envelope.connect(master);
  [1, 2, 3].forEach((harmonic, index) => {
    const oscillator = audioContext.createOscillator();
    const partial = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = frequency * harmonic;
    partial.gain.value = [1, .25, .06][index];
    oscillator.connect(partial).connect(envelope);
    oscillator.start(at);
    oscillator.stop(at + duration + .02);
  });
}

function queuePhrase() {
  const chords = [[48,60,64,67], [45,57,60,64], [41,53,57,60], [43,55,59,62]];
  const start = audioContext.currentTime + .08;
  chords.forEach((chord, index) => {
    pianoNote(chord[0], start + index * 3.2, 3.0, .12);
    [1, 2, 3, 2, 1, 3, 2, 3].forEach((note, beat) => pianoNote(chord[note] + (beat === 7 ? 12 : 0), start + index * 3.2 + beat * .4, 1.8, .065));
  });
}

async function stopMusic() {
  if (externalAudio) externalAudio.pause();
  clearInterval(timer);
  if (audioContext && audioContext.state !== 'closed') await audioContext.close();
  audioContext = null;
  master = null;
  setMusicState(false);
}

musicButton.addEventListener('click', async () => {
  if (musicPlaying) { await stopMusic(); return; }
  try {
    if (config.music) {
      externalAudio ??= new Audio(config.music);
      externalAudio.loop = true;
      externalAudio.volume = .4;
      await externalAudio.play();
    } else {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!audioContext) {
        audioContext = new AudioContextClass();
        master = audioContext.createGain();
        master.gain.value = .65;
        master.connect(audioContext.destination);
      }
      await audioContext.resume();
      queuePhrase();
      timer = setInterval(queuePhrase, 12800);
    }
    setMusicState(true);
  } catch {
    await stopMusic();
    musicLabel.textContent = 'Не удалось включить звук. Попробуйте ещё раз.';
  }
});
document.addEventListener('visibilitychange', () => { if (document.hidden && musicPlaying) stopMusic(); });
window.addEventListener('pagehide', stopMusic);

// Keep the same identifier when a guest retries an unconfirmed submission.
let pendingRsvp;
document.getElementById('rsvp-form').addEventListener('submit', async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const status = document.getElementById('form-status');
  const name = form.elements.guests;
  const submit = form.querySelector('button[type="submit"]');
  if (submit.disabled || !form.reportValidity()) return;
  if (!name.value.trim()) {
    name.setCustomValidity('Напишите ваше имя.');
    name.reportValidity();
    name.addEventListener('input', () => name.setCustomValidity(''), {once: true});
    return;
  }
  status.hidden = false;
  if (!config.rsvpEndpoint) {
    status.textContent = 'Анкета временно недоступна. Пожалуйста, попробуйте позже.';
    status.focus({preventScroll: true});
    return;
  }
  const formData = new FormData(form);
  const answer = {
    attendance: formData.get('attendance'),
    guests: name.value.trim(),
    drinks: formData.getAll('drinks'),
  };
  const fingerprint = JSON.stringify(answer);
  if (!pendingRsvp || pendingRsvp.fingerprint !== fingerprint) {
    pendingRsvp = {
      fingerprint,
      requestId: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
  }
  const requestId = pendingRsvp.requestId;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  const fields = [...form.querySelectorAll('input, textarea')];
  fields.forEach(field => { field.disabled = true; });
  submit.disabled = true;
  form.setAttribute('aria-busy', 'true');
  submit.textContent = 'ОТПРАВЛЯЕМ…';
  status.textContent = 'Сохраняем ваш ответ…';
  try {
    const response = await fetch(config.rsvpEndpoint, {
      // A simple POST avoids an OPTIONS preflight unsupported by Apps Script.
      method: 'POST', headers: {'Content-Type': 'text/plain;charset=UTF-8'},
      credentials: 'omit', redirect: 'follow', signal: controller.signal,
      body: JSON.stringify({...answer, requestId}),
    });
    if (!response.ok) throw new Error('Request failed');
    const result = await response.json();
    if (result.ok !== true || result.requestId !== requestId) throw new Error('Save was not confirmed');
    status.textContent = 'Спасибо! Ваш ответ сохранён.';
    form.reset();
    pendingRsvp = null;
  } catch {
    status.textContent = 'Не удалось подтвердить отправку. Проверьте соединение и попробуйте ещё раз. Заполненные данные сохранены в анкете.';
  } finally {
    clearTimeout(timeout);
    fields.forEach(field => { field.disabled = false; });
    submit.disabled = false;
    form.removeAttribute('aria-busy');
    submit.textContent = 'ОТПРАВИТЬ';
    status.focus({preventScroll: true});
    window.ScrollTrigger?.refresh();
  }
});
