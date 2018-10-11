const TokenVestingMock = artifacts.require('TokenVestingMock');
const TokenMock = artifacts.require('TokenMock');
import { latestTime } from 'openzeppelin-solidity/test/helpers/latestTime';
import { increaseTimeTo, duration } from 'openzeppelin-solidity/test/helpers/increaseTime';
import { ether } from 'openzeppelin-solidity/test/helpers/ether';
import EVMRevert from 'openzeppelin-solidity/test/helpers/EVMRevert';
import { log, isFunction } from 'util';


const BigNumber = web3.BigNumber;
const should = require('chai')
    .use(require('chai-as-promised'))
    .use(require('chai-bignumber')(BigNumber))
    .should();

contract('TokenVesting', function (accounts) {
    var data = {};

    beforeEach(async function () {

		data.token = await TokenMock.new();
        data.tokenVesting = await TokenVestingMock.new(data.token.address,accounts[1],120,10,10);/* start time is default 100 seconds form now*/
		var amountToApprove = ((await data.token.totalSupply()).div(2)).toString();
		var amountToTransfer = ((await data.token.totalSupply()).div(2)).toString();
		await data.token.approve(data.tokenVesting.address,amountToApprove);
		await data.token.approve(data.tokenVesting.address,amountToApprove,{from: accounts[1]});
		await data.token.transfer(accounts[1],amountToTransfer);
		var _owner = (await data.tokenVesting.owner()).toString();
    });

		contract('claimTokens vesting not funded', function () {
			
			beforeEach(async function(){
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
			});

			it('claim tokens will fail if contract not funded', async function () {
				var _now = await latestTime();
				await increaseTimeTo(_now+150);
				
				await data.tokenVesting.claimTokens({from:accounts[1]}).should.be.rejectedWith(EVMRevert);;
			});			
		});
		contract('claimTokens', function () {
			beforeEach(async function(){
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
				await data.tokenVesting.fundVesting(allowance,{from:accounts[0]});//.should.be.rejectedWith(EVMRevert);
			});
			
			it('claim tokens will fail if called before start time', async function () {
				
				await data.tokenVesting.claimTokens({from:accounts[1]}).should.be.rejectedWith(EVMRevert);
			});
			it('claim tokens will success if called by reciver', async function () {
				var _now = await latestTime();
				
				await increaseTimeTo(_now+150);
				
				await data.tokenVesting.claimTokens({from:accounts[1]});
			});
			it('claim tokens will fail if called by not reciver', async function () {
				var _now = await latestTime();
				await increaseTimeTo(_now+150);
				
				await data.tokenVesting.claimTokens({from:accounts[0]}).should.be.rejectedWith(EVMRevert);
			});
			
			it('claim tokens will release amount proportional to time Passed', async function () {
				var _now = await latestTime();
				await increaseTimeTo(_now+150);
				
				const { logs } = await data.tokenVesting.claimTokens({from:accounts[1]});
			
				logs[0].args.tokensClaimed.should.be.bignumber.equal(new BigNumber(15000)); /* 3 periods 5000 each */
			});
			
			it('claim tokens will emit tokens claimed event if succeded', async function () {
				var _now = await latestTime();
				await increaseTimeTo(_now+150);
				
				const { logs } = await data.tokenVesting.claimTokens({from:accounts[1]});
			
				logs[0].event.should.equal('TokensClaimed');
			});
		});
			
		contract('killVesting', function () {
			
			it('kill vesting will succeed if performed by owner', async function () {
				await data.tokenVesting.killVesting({from:accounts[0]});//.should.be.rejectedWith(EVMRevert);
			});
			
			it('kill vesting will fail if performed by not owner', async function () {
				await data.tokenVesting.killVesting({from:accounts[1]}).should.be.rejectedWith(EVMRevert);
			});
			
			it('kill vesting if succeed will emit Transfer event with proper sender recipient and value', async function () {
				var retValData =  await data.tokenVesting.killVesting({from:accounts[0]});
				var balanceAfter = await data.token.balanceOf(data.tokenVesting.address);
				return new Promise(function(res,rej){
					data.token.contract.Transfer({fromBlock:retValData.receipt.blockNumber-1},function(err,result){
						if(err!=null){
							rej(err);
						}
						else{
							result.event.should.equal('Transfer');
							balanceAfter.should.be.bignumber.equal(0);
							res(true);
						}
					})
				});
			});
		});
			
		contract('fundVesting', function () {
			
			it('funding vesting will succeed if performed by owner with sufficent funds and allowence', async function () {
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
				await data.tokenVesting.fundVesting(allowance,{from:accounts[0]});//.should.be.rejectedWith(EVMRevert);
			});
			
			it('funding vesting will fail if performed by not owner', async function () {
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
				await data.tokenVesting.fundVesting(allowance,{from:accounts[1]}).should.be.rejectedWith(EVMRevert);
			});

			it('funding vesting for amount different than allowence will fail', async function () {
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).sub(1).toString();
				await data.tokenVesting.fundVesting(allowance,{from:accounts[0]}).should.be.rejectedWith(EVMRevert);
			});
			
			it('funding vesting will fail if performed by owner without proper balance', async function () {
				var amountToApprove = (await data.token.totalSupply()).toString();
				await data.token.approve(data.tokenVesting.address,amountToApprove);
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
				await data.tokenVesting.fundVesting(allowance,{from:accounts[0]}).should.be.rejectedWith(EVMRevert);
			});
			
			it('funding vesting if succeed will emit VestingFunded event with proper amount', async function () {
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
				const { logs } = await data.tokenVesting.fundVesting(allowance,{from:accounts[0]});//.should.be.rejectedWith(EVMRevert);
				logs[0].event.should.equal('VestingFunded');
				logs[0].args.totalTokens.should.be.bignumber.equal(allowance);
			});

			it('funding vesting if succeed will emit Transfer event with proper sender recipient and value', async function () {
				var allowance =  (await data.token.allowance(accounts[0], data.tokenVesting.address)).toString();
				return new Promise(async function(res,rej){
					var retValData = await data.tokenVesting.fundVesting(allowance,{from:accounts[0]});//.should.be.rejectedWith(EVMRevert);
					data.token.contract.Transfer({fromBlock:retValData.receipt.blockNumber},function(err,result){
						if(err!=null){
							rej(err);
						}
						else{
							result.event.should.equal('Transfer');
							result.args.from.should.equal(accounts[0]);
							result.args.to.should.equal(data.tokenVesting.address);
							res(true);
						}
					})
				});
			});

		});


});




