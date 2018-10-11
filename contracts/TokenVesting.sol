pragma solidity ^0.4.24;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/math/SafeMath.sol";

contract TokenVesting is Ownable {
  using SafeMath for uint;

  ERC20 public token;
  address public receiver;
  uint256 public startTime;
  uint256 public cliff;
  uint256 public totalPeriods;
  uint256 public timePerPeriod;
  uint256 public totalTokens;
  uint256 public tokensClaimed;

  event VestingFunded(uint256 totalTokens);
  event TokensClaimed(uint256 tokensClaimed);
  event VestingKilled();

  constructor(
    address _token,
    address _receiver,
	//I believe this two variables should be replaced with one - that is _vestingStartTime equal to _startTime.add(_cliff)
    uint256 _startTime,
    uint256 _cliff,
    uint256 _totalPeriods,
    uint256 _timePerPeriod
  ) public {
    token = ERC20(_token);
    receiver = _receiver;
    startTime = _startTime;
    cliff = _cliff;
    totalPeriods = _totalPeriods;
    timePerPeriod = _timePerPeriod;
  }
  
  function getNow() public view returns(uint256){
	return now;
  }

  function fundVesting(uint256 _totalTokens) public onlyOwner {
    require(totalTokens == 0, "Vesting already funded");
    require(_totalTokens > 0); //this is redundand because of next line , if allowence is 0 then it is still ok since nothing happens
    require(token.allowance(owner, address(this)) == _totalTokens); //this should be require(token.allowance(owner, address(this)) >= _totalTokens);
    totalTokens = _totalTokens;
    token.transferFrom(owner, address(this), totalTokens);
    emit VestingFunded(_totalTokens);
  }

  function claimTokens() public {
    require(totalTokens > 0, "Vesting has not been funded yet");
    require(msg.sender == receiver, "Only receiver can claim tokens");
    require(getNow() > startTime.add(cliff), "Vesting hasnt started yet"); 

    uint256 timePassed = getNow().sub(startTime.add(cliff));
    uint256 tokensToClaim = totalTokens
      .div(totalPeriods)
      .mul(timePassed.div(timePerPeriod))
      .sub(tokensClaimed);

    token.transfer(receiver, tokensToClaim);
    tokensClaimed = tokensClaimed.add(tokensToClaim);

    emit TokensClaimed(tokensToClaim);
	
  }

  function killVesting() public onlyOwner {
    token.transfer(owner, totalTokens.sub(tokensClaimed));
    tokensClaimed = totalTokens;
    emit VestingKilled();
  }

}
