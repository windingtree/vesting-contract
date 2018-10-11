pragma solidity ^0.4.24;

import "../TokenVesting.sol";

contract TokenVestingMock is TokenVesting {

  constructor(
    address _token,
    address _receiver,
    uint256 _cliff,
    uint256 _totalPeriods,
    uint256 _timePerPeriod
  ) TokenVesting(
    _token,
    _receiver,
    now+100,
    _cliff,
    _totalPeriods,
    _timePerPeriod) {
		setNow(now+100000);
	}
	
   uint256 public _now;
   
  
  function getNow() public view returns(uint256){
	return _now;
  }
  
  function setNow(uint256 _n) public{
	_now=_n;
  }
  
}
