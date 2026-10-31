const fs=require('fs');const p='src/components/AdminManagement.tsx';let s=fs.readFileSync(p,'utf8').replaceAll('<Feedback ', '<AdminFeedback ');fs.writeFileSync(p,s);
