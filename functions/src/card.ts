import { BasicCard } from "actions-on-google";
import * as removeMd from "remove-markdown";
import * as rp from "request-promise";

export class Card extends Object {
  token: string;
  id: string;
  boardId: string;
  columnId: string;
  name: string;
  description: string = '';
  createdAt: Date;
  updatedAt: Date;
  assignees: any[];
  labels: any[];
  dueDate: Date;
  createdBy: string;
  type: string = 'card';

  constructor(
    token: string,
    name: string,
    id: string,
    description,
    board_id: string,
    column_id: string,
    created_date: string,
    updated_date: string,
    assignees: any[],
    labels: any[],
    due_date: string,
    created_by
  ) {
    super();
    this.token = token;
    this.name = name;
    this.id = id;
    if(description) {
      this.description = removeMd(description.text).replace("\n", "  \n");
    } else {
      this.description = `No description`;
    }
    this.boardId = board_id;
    this.columnId = column_id;
    this.createdAt = new Date(created_date);
    this.updatedAt = new Date(updated_date);
    this.assignees = assignees;
    this.labels = labels;
    this.dueDate = due_date ? new Date(due_date) : null;
    this.createdBy = created_by;
  }

  getVisualCard = () => {
    console.log(`Assigness: ${JSON.stringify(this.assignees)}`);
    return new BasicCard({
      title: this.name,
      subtitle: `${this.dueDate ? `Due by ${this.dueDate.toLocaleDateString()}, `: ``}Updated at ${this.updatedAt.toLocaleTimeString()}`,
      text: this.description
    });
  };

  getVoiceCard = () => {
      return `The ${this.name} updated at ${this.updatedAt.toLocaleTimeString()}. Here is the description: ${this.description}. How can I help you next?`;
  }

  setAsArchived = async () => {
    try {
      let options = {
        method: "POST",
        uri: `https://gloapi.gitkraken.com/v1/glo/boards/${this.boardId}/cards/${this.id}?access_token=${
          this.token
        }`,
        body: JSON.stringify({ archived_date: new Date().toISOString() }),
        headers: {
          "Content-Type": "application/json"
        }
      };
      console.log(options);
      return rp(options).then(result => {
        console.log(result);
        console.log(JSON.parse(result));
        return result;
      });
    } catch (error) {
      console.error(error);
    }
  };

}

module.exports = {
  Card
};
