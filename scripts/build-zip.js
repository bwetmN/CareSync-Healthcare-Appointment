import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const rootDir = process.cwd();
const zipFileName = 'healthcare-appointment-manager.zip';
const zipFilePath = path.join(rootDir, zipFileName);

console.log(`📦 Packaging complete source code into ${zipFileName}...`);

// Use Python's built-in zipfile module for guaranteed cross-platform zip creation without external npm dependencies
const pythonZipScript = `
import zipfile
import os

root_dir = r"${rootDir.replace(/\\/g, '\\\\')}"
zip_path = r"${zipFilePath.replace(/\\/g, '\\\\')}"

exclude_dirs = {'node_modules', '.git', 'dist', '.cache', '.turbo', '.next'}
exclude_files = {'healthcare-appointment-manager.zip', 'dev.db-journal'}

with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk(root_dir):
        # Exclude directories
        dirs[:] = [d for d in dirs if d not in exclude_dirs]
        for file in files:
            if file in exclude_files:
                continue
            full_path = os.path.join(root, file)
            rel_path = os.path.relpath(full_path, root_dir)
            zipf.write(full_path, rel_path)

print(f"Zip created successfully at: {zip_path}")
`;

const tempScriptPath = path.join(rootDir, 'temp_zip.py');
fs.writeFileSync(tempScriptPath, pythonZipScript);

try {
  execSync(`python "${tempScriptPath}"`, { stdio: 'inherit' });
  fs.unlinkSync(tempScriptPath);
  console.log(`🎉 Source code deliverable created: ${zipFileName}`);
} catch (err) {
  console.error('Error creating zip:', err);
  if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath);
}
