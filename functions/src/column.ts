
export class Column extends Object{
    token;
    id;
    name;
    type: string = 'column';
    constructor(token:string, name:string, id:string) {
        super();
        this.token = token;
        this.name = name;
        this.id = id;
    }
}

module.exports = {
    Column,
}