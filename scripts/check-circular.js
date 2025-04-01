const fs = require('fs');
const path = require('path');

// Read package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
let packageJson;

try {
  // Read the package.json file
  const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');
  packageJson = JSON.parse(packageJsonContent);
  
  // Get the package name
  const packageName = packageJson.name;
  let modified = false;
  
  // Check for circular dependency in dependencies
  if (packageJson.dependencies && packageJson.dependencies[packageName]) {
    console.error(`ERROR: Circular dependency detected in dependencies: ${packageName}`);
    delete packageJson.dependencies[packageName];
    modified = true;
  }
  
  // Also check devDependencies
  if (packageJson.devDependencies && packageJson.devDependencies[packageName]) {
    console.error(`ERROR: Circular dependency detected in devDependencies: ${packageName}`);
    delete packageJson.devDependencies[packageName];
    modified = true;
  }
  
  // If we found and removed circular dependencies, write the fixed package.json
  if (modified) {
    fs.writeFileSync(
      packageJsonPath, 
      JSON.stringify(packageJson, null, 2) + '\n',
      'utf8'
    );
    console.log('✅ Fixed package.json by removing circular dependencies');
  } else {
    console.log('✅ No circular dependencies detected in package.json');
  }
} catch (error) {
  console.error('Failed to check for circular dependencies:', error.message);
  process.exit(1);
}