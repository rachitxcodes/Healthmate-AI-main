const fs = require('fs');
const path = require('path');

const walkSync = (dir, filelist = []) => {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        filelist = walkSync(dirFile, filelist);
      } else {
        if (dirFile.endsWith('.tsx') || dirFile.endsWith('.ts')) {
          filelist.push(dirFile);
        }
      }
    } catch (err) {}
  });
  return filelist;
};

const files = walkSync('q:/AntiHero/Healthmate-AI/frontend/src');

const tokens = {
  'text-slate-400': 'text-slate-500',
  'text-slate-500': 'text-slate-600', 
  'text-slate-600': 'text-slate-700',
  'text-slate-700': 'text-slate-800',
  
  'text-xs': 'text-[13px]',
  'text-[11px]': 'text-xs',
  'text-[13px]': 'text-[14px]',
  'text-sm': 'text-[15px]',
  'text-[14px]': 'text-[15px]',
  'text-[15px]': 'text-base',
  'text-[15.5px]': 'text-base',
  
  'text-base': 'text-[17px]'
};

const regexStr = '(?<=[\\\\s\\"\\'\\>])(' + Object.keys(tokens).map(k => k.replace(/[-[\\]{}()*+?.,\\\\^$|#\\s]/g, '\\\\$&')).join('|') + ')(?=[\\\\s\\"\\'\\<])';
const regex = new RegExp(regexStr, 'g');

let updatedCount = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  let newContent = content.replace(regex, match => tokens[match]);
  
  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf8');
    console.log('Updated: ' + file);
    updatedCount++;
  }
});

console.log('Total files updated: ' + updatedCount);
