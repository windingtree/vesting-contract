pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract TokenMock is MintableToken {

  constructor() public {
	mint(msg.sender,100000);
	mintingFinished = true;
  }

}
