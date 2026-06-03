const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

const products = [
  { name: 'Freelance Contract', file: 'freelance-contract', tag: 'freelancer' },
  { name: 'Photography Contract', file: 'photography-contract', tag: 'photographer' },
  { name: 'Web Design Contract', file: 'web-design-contract', tag: 'webdesign' },
  { name: 'NDA Generator', file: 'nda-generator', tag: 'NDA' },
  { name: 'Independent Contractor', file: 'independent-contractor', tag: 'contractor' },
  { name: 'Service Agreement', file: 'service-agreement', tag: 'serviceagreement' },
  { name: 'Consulting Agreement', file: 'consulting-agreement', tag: 'consultant' },
  { name: 'Social Media Contract', file: 'social-media-contract', tag: 'socialmedia' },
  { name: 'Graphic Design Contract', file: 'graphic-design-contract', tag: 'graphicdesign' },
  { name: 'Copywriting Contract', file: 'copywriting-contract', tag: 'copywriter' },
  { name: 'Virtual Assistant Contract', file: 'virtual-assistant-contract', tag: 'virtualassistant' },
  { name: 'Logo Design Contract', file: 'logo-design-contract', tag: 'logodesign' },
  { name: 'Brand Ambassador Contract', file: 'brand-ambassador-contract', tag: 'brandambassador' },
  { name: 'Videography Contract', file: 'videography-contract', tag: 'videographer' },
  { name: 'Influencer Contract', file: 'influencer-contract', tag: 'influencer' },
  { name: 'Music Producer Contract', file: 'music-producer-contract', tag: 'musicproducer' },
  { name: 'Video Editing Contract', file: 'video-editing-contract', tag: 'videoeditor' },
  { name: 'Client Onboarding Contract', file: 'client-onboarding-contract', tag: 'clientonboarding' },
  { name: 'Website Maintenance Contract', file: 'website-maintenance-contract', tag: 'webmaintenance' },
  { name: 'Invoice Template', file: 'invoice-template', tag: 'invoice' },
];

const W = 1000;
const H = 1500;
const outputDir = __dirname;

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, currentY);
  return currentY;
}

for (const product of products) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 0, H);
  grad.addColorStop(0, '#1e3a5f');
  grad.addColorStop(1, '#2563eb');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Top accent bar
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, 0, W, 8);

  // Document emoji / icon area
  ctx.font = 'bold 120px serif';
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.textAlign = 'center';
  ctx.fillText('📄', W / 2, 300);

  // Emoji (visible)
  ctx.font = '100px serif';
  ctx.fillStyle = 'white';
  ctx.fillText('📄', W / 2, 295);

  // FREE badge
  ctx.fillStyle = '#10b981';
  const badgeW = 200, badgeH = 52, badgeX = (W - badgeW) / 2, badgeY = 340;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 26);
  ctx.fill();
  ctx.font = 'bold 26px Arial';
  ctx.fillStyle = 'white';
  ctx.textAlign = 'center';
  ctx.fillText('FREE TO GENERATE', W / 2, badgeY + 34);

  // Title
  ctx.fillStyle = 'white';
  ctx.font = 'bold 72px Arial';
  ctx.textAlign = 'center';
  wrapText(ctx, product.name, W / 2, 480, W - 80, 85);

  // Divider line
  ctx.strokeStyle = 'rgba(255,255,255,0.3)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(80, 660);
  ctx.lineTo(W - 80, 660);
  ctx.stroke();

  // Feature bullets
  const features = [
    '✅  Generate in seconds',
    '✅  Editable Word & PDF',
    '✅  No watermarks',
    '✅  Instant download',
    '✅  $7 to download',
  ];
  ctx.font = '38px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.textAlign = 'left';
  let fy = 730;
  for (const f of features) {
    ctx.fillText(f, 100, fy);
    fy += 72;
  }

  // CTA box
  ctx.fillStyle = '#f59e0b';
  const ctaW = 700, ctaH = 90, ctaX = (W - ctaW) / 2, ctaY = 1120;
  ctx.beginPath();
  ctx.roundRect(ctaX, ctaY, ctaW, ctaH, 16);
  ctx.fill();
  ctx.font = 'bold 40px Arial';
  ctx.fillStyle = '#1e3a5f';
  ctx.textAlign = 'center';
  ctx.fillText('Get Your Contract Now →', W / 2, ctaY + 57);

  // Bottom domain
  ctx.font = 'bold 34px Arial';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.textAlign = 'center';
  ctx.fillText('contractfixpro.com', W / 2, 1320);

  // Bottom accent
  ctx.fillStyle = '#f59e0b';
  ctx.fillRect(0, H - 8, W, 8);

  // Save
  const out = fs.createWriteStream(path.join(outputDir, `${product.file}.png`));
  const stream = canvas.createPNGStream();
  stream.pipe(out);
  out.on('finish', () => console.log(`✓ ${product.file}.png`));
}
