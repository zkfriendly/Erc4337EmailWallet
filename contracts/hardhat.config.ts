import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@nomicfoundation/hardhat-ethers";

const config: HardhatUserConfig = {
  solidity: "0.8.27",
  networks: {
    dev: {
      chainId: 31337,
      url: "http://127.0.0.1:8545",
    },
  },
};

export default config;
