// Copyright IBM Corp. 2018. All Rights Reserved.
// Node module: @loopback/example-todo-list
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

import {createClientForHandler, expect, supertest} from '@loopback/testlab';
import {TodoListApplication} from '../../src/application';
import {Todo, TodoList} from '../../src/models/';
import {TodoRepository, TodoListRepository} from '../../src/repositories/';
import {givenTodo, givenTodoList} from '../helpers';

describe('Application', () => {
  let app: TodoListApplication;
  let client: supertest.SuperTest<supertest.Test>;
  let todoRepo: TodoRepository;
  let todoListRepo: TodoListRepository;

  before(givenRunningApplicationWithCustomConfiguration);
  after(() => app.stop());

  before(givenTodoRepository);
  before(givenTodoListRepository);
  before(() => {
    client = createClientForHandler(app.requestHandler);
  });

  beforeEach(async () => {
    await todoRepo.deleteAll();
    await todoListRepo.deleteAll();
  });

  it('creates todo for a todoList', async () => {
    const todoList = await givenTodoListInstance();
    const todo = givenTodo();
    const response = await client
      .post(`/todo-lists/${todoList.id}/todos`)
      .send(todo)
      .expect(200);

    expect(response.body).to.containDeep(todo);
  });

  it('finds todos for a todoList', async () => {
    const todoList = await givenTodoListInstance();
    const notMyTodo = await givenTodoInstance({
      title: 'someone else does a thing',
    });
    const myTodos = [
      await givenTodoInstanceOfTodoList(todoList.id),
      await givenTodoInstanceOfTodoList(todoList.id, {
        title: 'another thing needs doing',
      }),
    ];
    const response = await client
      .get(`/todo-lists/${todoList.id}/todos`)
      .send()
      .expect(200);

    expect(response.body)
      .to.containDeep(myTodos)
      .and.not.containEql(notMyTodo.toJSON()); // is this assertion necessary?
  });

  it('updates todos for a todoList', async () => {
    const todoList = await givenTodoListInstance();
    const notMyTodo = await givenTodoInstance({
      title: 'someone else does a thing',
    });
    const myTodos = [
      await givenTodoInstanceOfTodoList(todoList.id),
      await givenTodoInstanceOfTodoList(todoList.id, {
        title: 'another thing needs doing',
      }),
    ];
    const patchedIsCompleteTodo = {isComplete: true};
    const response = await client
      .patch(`/todo-lists/${todoList.id}/todos`)
      .send(patchedIsCompleteTodo)
      .expect(200);

    expect(response.body).to.eql(myTodos.length);
    const updatedTodos = await todoListRepo.todos(todoList.id).find();
    const notUpdatedTodo = await todoRepo.findById(notMyTodo.id);
    for (const todo of updatedTodos) {
      expect(todo.toJSON()).to.containEql(patchedIsCompleteTodo);
    }
    expect(notUpdatedTodo.toJSON()).to.not.containEql(patchedIsCompleteTodo);
  });

  it('deletes todos for a todoList', async () => {
    const todoList = await givenTodoListInstance();
    const notMyTodo = await givenTodoInstance({
      title: 'someone else does a thing',
    });
    await givenTodoInstanceOfTodoList(todoList.id);
    await givenTodoInstanceOfTodoList(todoList.id, {
      title: 'another thing needs doing',
    });
    await client
      .del(`/todo-lists/${todoList.id}/todos`)
      .send()
      .expect(200);

    const myDeletedTodos = await todoListRepo.todos(todoList.id).find();
    const notDeletedTodo = await todoRepo.findById(notMyTodo.id);
    expect(myDeletedTodos).to.be.empty();
    expect(notDeletedTodo).to.eql(notMyTodo);
  });

  /*
   ============================================================================
   TEST HELPERS
   These functions help simplify setup of your test fixtures so that your tests
   can:
   - operate on a "clean" environment each time (a fresh in-memory database)
   - avoid polluting the test with large quantities of setup logic to keep
   them clear and easy to read
   - keep them DRY (who wants to write the same stuff over and over?)
   ============================================================================
   */

  async function givenRunningApplicationWithCustomConfiguration() {
    app = new TodoListApplication({
      rest: {
        port: 0,
      },
    });

    await app.boot();

    /**
     * Override default config for DataSource for testing so we don't write
     * test data to file when using the memory connector.
     */
    app.bind('datasources.config.db').to({
      name: 'db',
      connector: 'memory',
    });

    // Start Application
    await app.start();
  }

  async function givenTodoRepository() {
    todoRepo = await app.getRepository(TodoRepository);
  }

  async function givenTodoListRepository() {
    todoListRepo = await app.getRepository(TodoListRepository);
  }

  async function givenTodoInstance(todo?: Partial<Todo>) {
    return await todoRepo.create(givenTodo(todo));
  }

  async function givenTodoInstanceOfTodoList(
    id: typeof Todo.prototype.id,
    todo?: Partial<Todo>,
  ) {
    return await todoListRepo.todos(id).create(givenTodo(todo));
  }

  async function givenTodoListInstance(todoList?: Partial<TodoList>) {
    return await todoListRepo.create(givenTodoList(todoList));
  }
});
