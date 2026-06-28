const fs = require('fs');
const path = require('path');

exports.handler = async () => {
  const products = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../data/products.json'), 'utf8')
  );
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(products)
  };
};
