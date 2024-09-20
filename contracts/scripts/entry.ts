(async () => {
  const { ethers } = await import("hardhat");
  const node = new ethers.JsonRpcProvider("http://localhost:8545");
  const bundler = new ethers.JsonRpcProvider("http://localhost:3000/rpc");

  // supported entrypoints
  const entrypoints = await bundler.send("eth_supportedEntryPoints", []);
  console.log("supported entrypoints", entrypoints);
})();
