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

   /**
   *@dev contract contructor
   *@param _token address of erc20 token
   *@param _receiver address entitle to claim tokens
   *@param _startTime moment when counting time starts
   *@param _cliff delay from _startTime after which vesting starts
   */
  constructor(
    address _token,
    address _receiver,
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
  
   /**
   *@dev wrapper for current time to make contract testable
   */
  function getNow() public view returns(uint256){
	return now;
  }

   /**
   *@dev function responsible for supplying tokens that will be vested 
   *@param _totalTokens amount of tokens that will be supplied to this contract
   */
  function fundVesting(uint256 _totalTokens) public onlyOwner { // I believe this logic should be part of constructor, that would simplify other functions as well
    require(totalTokens == 0, "Vesting already funded");
    require(token.allowance(owner, address(this)) == _totalTokens);
    totalTokens = _totalTokens;
    token.transferFrom(owner, address(this), totalTokens);
    emit VestingFunded(_totalTokens);
  }

   /**
   *@dev function that allows receiver to claim tokens
   */
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

   /**
   *@dev function that allows cancel vesting
   */
  function killVesting() public onlyOwner {
    token.transfer(owner, totalTokens.sub(tokensClaimed));
    tokensClaimed = totalTokens;
    emit VestingKilled();
  }

}
