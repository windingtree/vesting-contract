pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/MintableToken.sol";

contract TokenMock is MintableToken {

  constructor(uint256 _initialBalance) public {
  	mint(msg.sender, _initialBalance);
  	mintingFinished = true;
  }

}
