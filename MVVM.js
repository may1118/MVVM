// 自己实现vue的基本功能
// 现在需要实现,如果数据改变,那么就需要更新页面
// 观察者模式(发布订阅)
class Dep {
  constructor() {
    this.subs = []; // 存放所有的watcher
  }
  addSub(watcher) {
    this.subs.push(watcher);
  }
  // 发布
  notify() {
    this.subs.forEach(item => {
      item.update();
    });
  }
}
class Watcher {
  constructor(vm, expr, cb) {
    this.vm = vm;
    this.expr = expr;
    this.cb = cb;
    // 默认先存放一个旧值
    this.oldVal = this.get();
  }
  get() {
    // 先把自己放在this上
    Dep.terget = this;
    //  观察者和数据关联起来
    let value = CompileUtil.getValue(this.vm, this.expr);
    // 取消
    Dep.terget = null;
    return value;
  }
  update() {
    let newVal = CompileUtil.getValue(this.vm, this.expr);
    if (newVal !== this.oldVal) {
      this.cb(newVal);
    }
  }
}

class Compiler {
  constructor(el, vm) {
    // 判断el的属性，是不是一个元素（字符串）
    // 有时候传过来的可能就是一个元素节点：document.getElementById('...')
    this.el = this.isElementNode(el) ? el : document.querySelector(el);
    this.vm = vm;
    // 拿到结点之后，需要将页面上使用了的地方进行替换
    // 注意：减少重排的次数，可以放到内存中
    let fragment = this.node2fragment(this.el);
    // 将文本的内容进行替换
    this.compiler(fragment);

    // 把内容塞到页面中
    this.el.appendChild(fragment);
  }
  // 编译内存中的dom节点
  compiler(node) {
    // 找到需要替换的内容
    let childNodes = node.childNodes;
    // 元素:看有没有v-model
    // 文本:看有没有{{...}}

    // 伪数组转数组
    [...childNodes].forEach((item, index) => {
      if (this.isElementNode(item)) {
        // 是元素
        this.compilerElement(item);
        // 如果是元素 还要遍历它的子节点(递归)
        this.compiler(item);
      } else {
        // 是文本
        this.compilerText(item);
      }
    });
  }
  isDirective(name, contain) {
    return name.startsWith(contain);
  }
  // 编译元素
  compilerElement(node) {
    // 看有没有v-model
    let attributes = node.attributes; // 类:伪数组
    [...attributes].forEach(item => {
      // typeof item ---> object
      let { name, value: expr } = item;
      if (this.isDirective(name, 'v-')) {
        // 现在暂时处理的是v-指令,之后还需要处理其他指令
        // 暂时处理的是v-model = school.name
        let [, directive] = name.split('-');
        // v-on:click---继续分割
        let [directiveName, eventName] = directive.split(':');
        // 调用对应的方法(这个是全局方法)
        CompileUtil[directiveName](node, expr, this.vm, eventName);
      }
    });
  }
  // 编译文本
  compilerText(node) {
    // 看有没有{{...}}
    let text = node.textContent;
    // 正则匹配自己需要的内容
    if (/\{\{(.+?)\}\}/.test(text)) {
      // 将内容进行填充
      CompileUtil['text'](node, text, this.vm);
    }
  }
  // 节点移动到内存中
  node2fragment(node) {
    /**
     * DocumentFragments 是DOM节点。
     * 它们不是主DOM树的一部分。
     * 通常的用例是创建文档片段，将元素附加到文档片段，
     * 然后将文档片段附加到DOM树。
     * 在DOM树中，文档片段被其所有的子元素所代替。
     * 优点：可以减少文档重排的次数
     */
    let fragment = document.createDocumentFragment();
    let firstChild;
    // 一个死循环，是一个赋值语句
    let i = 0;
    while ((firstChild = node.firstChild)) {
      // 退出循环的条件：firstChild赋值之后，转换成boolean为false
      // appendChild具有移动性
      // 如果被插入的节点已经存在于当前文档的文档树中,
      // 则那个节点会首先从原先的位置移除,
      // 然后再插入到新的位置.
      fragment.appendChild(firstChild);
    }
    return fragment;
  }
  // 是不是元素节点
  isElementNode(node) {
    return node.nodeType === 1;
  }
}
let CompileUtil = {
  /**
   *
   * @param {节点} node
   * @param {表达式} expr
   * @param {当前实例} vm
   * 所有的v-xxx方法都是这三个参数
   */
  getValue(vm, expr) {
    let arr = expr.split('.');
    // arr.forEach(item=>{

    // });
    // 使用reduce去取内容
    return arr.reduce((data, current) => {
      return data[current];
    }, vm.$data);
  },
  setValue(vm, expr, value) {
    let arr = expr.split('.');
    arr.reduce((data, current, index, array) => {
      if (index == array.length - 1) {
        return (data[current] = value);
      }
      return data[current];
    }, vm.$data);
  },
  on(node, expr, vm, eventName) {
    node.addEventListener(eventName, e => {
      vm[expr].call(vm, e);
    });
  },
  model(node, expr, vm) {
    //----这样去执行,减少耦合行
    let fn = this.updater['modelUpdater'];

    // 需要获取到school.name 在 vm中的内容
    new Watcher(vm, expr, newVal => {
      // 加入一个观察者
      // 更新
      fn(node, newVal);
    });
    node.addEventListener('input', e => {
      let newVal = e.target.value;
      this.setValue(vm, expr, newVal);
    });
    let value = this.getValue(vm, expr);
    fn(node, value);
  },
  html(node, expr, vm) {
    let fn = this.updater['htmlUpdater'];
    new Watcher(vm, expr, newVal => {
      fn(node, newVal);
    });
    let value = this.getValue(vm, expr);
    fn(node, value);
  },
  getContentVal(vm, expr) {
    return expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      return this.getValue(vm, args[1]);
    });
  },
  text(node, expr, vm) {
    let fn = this.updater['textUpdater'];
    // expr可能有多个{{a}}{{b}}
    let context = expr.replace(/\{\{(.+?)\}\}/g, (...args) => {
      new Watcher(vm, args[1], () => {
        //  给每个{{}}都加上观察者
        // 更新,只属于需要替换的一部分,而不是全部替换
        let val = this.getContentVal(vm, expr);
        fn(node, val);
      });
      fn(node, args[1]);
      return this.getValue(vm, args[1]);
    });
    fn(node, context);
  },
  updater: {
    modelUpdater(node, value) {
      node.value = value;
    },
    htmlUpdater(node, val) {
      node.innerHTML = val;
    },
    // 处理文本节点
    textUpdater(node, value) {
      node.textContent = value;
    }
  }
};
// 实现数据劫持的功能
class Observer {
  constructor(data) {
    this.observer(data);
  }
  observer(data) {
    if (data && typeof data === 'object') {
      // 如果是对象,需要循环每一项,并且使用Object.defineProperty
      for (let key in data) {
        this.defineReactive(data, key, data[key]);
      }
    }
  }
  defineReactive(obj, key, value) {
    // 如果value也是对象,里面属性也需要监听
    this.observer(value);
    // 给每一个属性加上一个具有发布订阅的功能
    let dep = new Dep();
    // 只监控了一层
    Object.defineProperty(obj, key, {
      get() {
        Dep.terget && dep.addSub(Dep.terget);
        return value;
      },
      set: newVal => {
        // 如果重新赋值是一个对象,则新对象也需要拥有get/set方法
        if (newVal !== value) {
          value = newVal;
          if (typeof value === 'object') {
            // 如果不想定义 _this = this;则可以改成箭头函数
            this.observer(value);
          }
          dep.notify();
        }
      }
    });
  }
}
class Vue {
  constructor(options) {
    this.$el = options.el;
    this.$data = options.data;
    let computed = options.computed;
    let methods = options.methods;
    // 根元素存在，需要编译模板
    if (this.$el) {
      // !!!important 数据劫持
      // 把数据全部用Object.defineProperty来定于
      new Observer(this.$data);
      // 数据获取操作 vm的取值操作都代理到vm.$data
      // vm.school === vm.$data.school;

      // 有依赖关系
      for (let key in computed) {
        Object.defineProperty(this.$data, key, {
          get: () => {
            return computed[key].call(this);
          }
        });
      }
      for (let key in methods) {
        Object.defineProperty(this, key, {
          get: () => {
            return methods[key];
          }
        });
      }
      this.proxyVm(this.$data);
      new Compiler(this.$el, this);
    }
  }
  proxyVm(data) {
    for (let key in data) {
      Object.defineProperty(this, key, {
        get() {
          return data[key];
        },
        set(newVal) {
          data[key] = newVal;
        }
      });
    }
  }
}
