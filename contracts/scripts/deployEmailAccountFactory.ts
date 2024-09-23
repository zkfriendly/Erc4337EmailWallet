import { ethers } from "hardhat";
(async() => {
    const bundlerProvider = new ethers.JsonRpcProvider(
     process.env.BUNDLER_URL
    );

    // get list of supported entrypoints
    const entrypoints = await bundlerProvider.send(
      "eth_supportedEntryPoints",
      []
    );

    if (entrypoints.length === 0) {
      throw new Error("No entrypoints found");
    }

    const entryPointAddress = entrypoints[0];

    // deploy the verifier
    const verifier = await ethers.getContractFactory("EmailAccountDummyVerifier");
    const verifierContract = await verifier.deploy();
    await verifierContract.waitForDeployment();
    const verifierAddress = await verifierContract.getAddress();

    // deploy the dkim registry
    const dkimRegistry = await ethers.getContractFactory("HMockDkimRegistry");
    const dkimRegistryContract = await dkimRegistry.deploy();
    await dkimRegistryContract.waitForDeployment();
    const dkimRegistryAddress = await dkimRegistryContract.getAddress();

    // deploy the factory
    const factory = await ethers.getContractFactory("EmailAccountFactory");
    const factoryContract = await factory.deploy(entryPointAddress, verifierAddress, dkimRegistryAddress);
    await factoryContract.waitForDeployment();
    const factoryAddress = await factoryContract.getAddress();
    
    console.log("Factory deployed at", factoryAddress);

})();
