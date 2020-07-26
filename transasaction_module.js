function Account(){
    this.arr = [];
    this.arr.push({cur : "$",
        value: 1000,   // 50 // 20
        state: "UnFrozen"})
    this.arr.push({cur: "E",
        value: 1000,
        state: "UnFrozen"})
    this.arr.push({$toE: 0.9,
        cash$: 0,
        cashE: 0,
        Eto$: 1.1})
}

function newAndCopyAccount(store){
    let ret = new Account();
    let {arr} = store.get(store.size);
    for (let i = 0; i < 2; i++){
        ret.arr[i].value = arr[i].value ;
        ret.arr[i].cur = arr[i].cur;
        ret.arr[i].state = arr[i].state ;
    }
    ret.arr[2].$toE = arr[2].$toE ;
    ret.arr[2].cash$ = arr[2].cash$;
    ret.arr[2].cashE = arr[2].cashE ;
    ret.arr[2].Eto$ = arr[2].Eto$ ;
    return ret;
}

let logs = function () {
    this.index = 0;
    this.meta = {
        title: '',
        description: ''
    };
    this.stepResult = {};
    this.NextStep = 0;
    this.error = null;
};

const setLogs = function (data, res, next, err) {
    let obj = data;
    obj.res = res;
    obj.next = next;
    obj.err = err;
    return obj;
};

const scenario = [
    {
        index: 1,
        meta: {
            title: 'Collect backup information from both accounts.',
            description: 'Collects pieces of data that required for restore scenario',
        },

        async call(store, logArr) {
            let tAcc = new Account();
            store.set(this.index, tAcc);
                let temp = setLogs(this, "Ok", this.index + 1, null);
                logArr.push(temp);
        },
        async restore(store, logs) {
            return this.index;
        },
    },
    {
        index: 2,
        meta: {
            title: 'Withdraw funds from a dollar account and  freezing account',
            description:
                'Takes off funds from a dollar account and freezing account until entire scenario ends successfully or unsuccessfully.',
        },
        async call(store, logArr) {
            return await new Promise((resolve, reject) => {
                let withdraw = 100;
                let tAcc = newAndCopyAccount(store);
                tAcc.arr[0].value -= withdraw;
                tAcc.arr[2].cash$ = withdraw;
                if (tAcc.arr[0].value >= 0) {
                    tAcc.arr[0].state = "Frozen";
                    store.set(this.index, tAcc);
                    let temp = setLogs(this, "Ok", this.index + 1, null);
                    logArr.push(temp);
                    resolve();
                } else {

                    let temp = setLogs(this, "Error", null, {
                        name: "overdraft",
                        message: "overdraft",
                        trace: "forbidden operation"
                    });
                    store.set(this.index, tAcc);
                    logArr.push(temp);
                    reject();
                }
            });
        },
        async restore(store, logs) {
            return new Promise((resolve, reject) => {
                if (store.get(this.index).arr[0].value < -70){
                    reject();
                }
                else{
                    store.get(this.index).arr[0].value += store.get(this.index).arr[2].cash$;
                    store.get(this.index).arr[2].cash$ -= store.get(this.index).arr[2].cash$;
                    resolve();
                }

            });
        },
    },
    {
        index: 3,
        meta: {
            title: 'Convert cash to euro.',
            description:
                'Convert withdrawal funds to euro currency.',
        },
        async call(store, logs) {
                let tAcc = newAndCopyAccount(store);
                tAcc.arr[2].cashE = tAcc.arr[2].cash$ * tAcc.arr[2].$toE;
                tAcc.arr[2].cash$ = 0;
                store.set(this.index, tAcc);
                let temp = setLogs(this, "Ok", this.index + 1, null);
                logs.push(temp);
        },
        async restore(store, logs) {
             return this.index;
        },
    },
    {
        index: 4,
        meta: {
            title: 'Withdrawal funds  send to the euro deposit.',
            description:
                'Withdrawal funds  send to the euro deposit and deposit freeze.',
        },
        async call(store, logs) {
            let tAcc = newAndCopyAccount(store);
            tAcc.arr[1].value += tAcc.arr[2].cashE;
            tAcc.arr[1].state = "Frozen";
            tAcc.arr[2].cashE = 0;
            store.set(this.index, tAcc);
                let temp = setLogs(this, "Ok", this.index + 1, null);
                logs.push(temp);
        },
        async restore(store, logs) {
            return this.index;
        },
    },
    {
        index: 5,
        meta: {
            title: 'Unfreeze the euro deposit.',
            description:
                'Unfreeze the euro deposit.',
        },
        async call(store, logs) {
            let tAcc = newAndCopyAccount(store);
            tAcc.arr[1].state = "Unfrozen";
            store.set(this.index, tAcc);
                let temp = setLogs(this, "Ok", this.index + 1, null);
                logs.push(temp);
        },
        async restore(store, logs) {
            return this.index;
        },
    },
    {
        index: 6,
        meta: {
            title: 'Unfreeze the dollar deposit.',
            description:
                'Unfreeze the dollar deposit.',
        },
        async call(store, logs) {
            let tAcc = newAndCopyAccount(store);
            tAcc.arr[0].state = "Unfrozen";
            store.set(this.index, tAcc);
            let temp = setLogs(this, "Ok", null, null);
            logs.push(temp);
        },
        async restore(store, logs) {
            return this.index;
        },
    },
];

class Transaction {
    constructor() {
        this.store = new Map();
        this.logs = [];
        this.status = '';
    }

    async dispatch(repertoire) {
        this.repertoire = repertoire;
        this.store.clear();
        this.logs.length = 0;
        this.status = '';
        for (let i = 0; i < repertoire.length; ++i) {

                await repertoire[i].call(this.store, this.logs).then(()=>{},
                    ()=>{
                    throw new Error("Wrong step");
                    }
                )
        }
        this.status = "Successfully fulfilled";
    }

    async rollback() {
        let last = this.store.get(this.store.size);
        let index = this.store.size - 1;
        await this.repertoire[index].restore(this.store, this.logs).then(
            ()=>{
                this.status = "Successfully restored";
            },
            () =>{
                this.status = "Unsuccessfully restored";
            }
        );
    };
}

const log = (data) => {
    if (!Array.isArray(data)) {
        if (typeof data === 'string') {
            console.log("Final state: ", data);
        } else {
            console.log("Store of each step:\n");
            for (let item of data.values()) {
                console.log(item);
            }
        }
    } else if (data.length > 0) {
        console.log("Logs of each step:\n");
        for (let item of data) {
            delete item.call;
            delete item.restore;
        }
        console.log(data);
    }
}

const transaction = new Transaction();
(async () => {
    try {
        await transaction.dispatch(scenario);
        const {store, logs, status} = transaction;
        log(store);
        log(logs);
        log(status);
    } catch (error) {
        await transaction.rollback();
        const {store, logs, status} = transaction;
        log(store);
        log(logs);
        log(status);
        console.log("Send email about broken transaction");
    }
})();

