package main

import (
	"flag"
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	"github.com/fatih/color"
	"gopkg.in/yaml.v2"
)

type Config struct {
	Vars  map[string]string `yaml:"vars"`
	Usage string            `yaml:"usage"` // Add the usage field
	Tasks []struct {
		Name     string   `yaml:"name"`
		Cmds     []string `yaml:"cmds"`
		Silent   bool     `yaml:"silent"`
		Parallel bool     `yaml:"parallel"`
		CtrlC    []string `yaml:"ctrlc"` // Change ctrlc to []string
	} `yaml:"modules"`
}

var ctrlcList []string // 新增全局切片来存储ctrlc内容

var ctrlc_flag bool

var doneCtrlcList = make(chan string)
var doneTask = make(chan string)
var taskFile string

func main() {
	var (
		variables map[string]string
		quietMode bool // Flag to indicate quiet mode
	)

	flag.StringVar(&taskFile, "w", "", "Path to the workflow YAML file")
	flag.BoolVar(&quietMode, "q", false, "Suppress banner")
	flag.Parse()
	log.SetFlags(0)

	// Color formatting functions
	cyan := color.New(color.FgCyan).SprintFunc()
	yellow := color.New(color.FgYellow).SprintFunc()
	red := color.New(color.FgRed).SprintFunc()
	green := color.New(color.FgGreen).SprintFunc()
	white := color.New(color.FgWhite).SprintFunc()
	magenta := color.New(color.FgMagenta).SprintFunc()

	// Print banner
	if !quietMode {
		// Print banner only if quiet mode is not enabled
		fmt.Printf("\n%s\n\n", white(`
	                         __         
	   _____________  ______/ /__  _____
	  / ___/ __  / / / / __  / _ \/ ___/
	 / /  / /_/ / /_/ / /_/ /  __/ /    
	/_/   \____/\___ /\____/\___/_/     
	           /____/                   

	           	     - v0.0.4 dev 🔱

`))

	}

	var defaultVars map[string]string
	yamlFileContent, err := ioutil.ReadFile(taskFile)
	if err == nil {
		var config Config
		err = yaml.Unmarshal(yamlFileContent, &config)
		if err == nil {
			defaultVars = config.Vars
		}
	}

	variables = parseArgs(defaultVars)

	if taskFile == "" {
		fmt.Println("Usage: rayder -w workflow.yaml [variable assignments e.g. DOMAIN=example.host]")
		return
	}

	taskFileContent, err := ioutil.ReadFile(taskFile)
	if err != nil {
		log.Fatalf("Error reading workflow file: %v", err)
	}

	var config Config
	err = yaml.Unmarshal(taskFileContent, &config)
	if err != nil {
		log.Fatalf("Error unmarshaling YAML: %v", err)
	}

	interrupt := make(chan os.Signal, 1)
	signal.Notify(interrupt, os.Interrupt, syscall.SIGTERM)

	// 创建一个退出信号的通道
	go func() {
		<-interrupt
		ctrlc_flag = true

		fmt.Printf("\n[%s] [%s] Received interrupt signal ⭕\n", yellow(currentTime()), red("INFO"))

		// 执行ctrlc列表中的命令
		if len(ctrlcList) > 0 {
			for _, action := range ctrlcList {
				execCmd := exec.Command("sh", "-c", action)
				execCmd.Stdin = os.Stdin
				execCmd.Stdout = os.Stdout
				execCmd.Stderr = os.Stderr
				execCmd.Run()
			}
		}

		close(doneCtrlcList)

		select {
		case msg1 := <-doneTask:

			if msg1 == "all_task_done" {
				doneTask <- "ctrlc_done"
			}
		case <-time.After(3 * time.Second):
			fmt.Printf("[%s] [%s] Maybe modules haven't exit ❌\n", yellow(currentTime()), red("INFO"))
			os.Exit(1)

		}

	}()

	runAllTasks(config, variables, cyan, magenta, white, yellow, red, green)
}

func parseArgs(defaultVars map[string]string) map[string]string {
	variables := make(map[string]string)
	usageRequested := false

	for _, arg := range flag.Args() {
		if arg == "usage" || arg == "USAGE" {
			usageRequested = true
			break
		}

		parts := strings.SplitN(arg, "=", 2)
		if len(parts) == 2 {
			if variables == nil {
				variables = make(map[string]string)
			}
			variables[parts[0]] = parts[1]
		}
	}

	// Check if "usage" was requested
	if usageRequested {
		fmt.Println("Usage:")
		fmt.Println(defaultVars["USAGE"])

		fmt.Println("\nVariables from YAML:")
		for key, value := range defaultVars {
			if key != "USAGE" {
				fmt.Printf("%s: %s\n", key, value)
			}
		}

		os.Exit(0)
	}

	// Apply default values if not provided by the user
	for key, defaultValue := range defaultVars {
		if _, exists := variables[key]; !exists {
			variables[key] = defaultValue
		}
	}

	return variables
}

func runAllTasks(config Config, variables map[string]string, cyan, magenta, white, yellow, red, green func(a ...interface{}) string) {
	var wg sync.WaitGroup
	var errorOccurred bool
	var errorMutex sync.Mutex

	for _, task := range config.Tasks {
		if task.Parallel {
			wg.Add(1)
			go func(name string, cmds []string, silent bool, vars map[string]string, ctrlc []string) {

				defer wg.Done()
				err := runTask(name, ctrlc, cmds, silent, vars, cyan, magenta, white, yellow, red, green)
				if ctrlc_flag == true {
					<-doneCtrlcList
				}

				if err != nil {
					errorMutex.Lock()
					errorOccurred = true
					fmt.Printf("[%s] [%s] Module '%s' %s ❌\n", yellow(currentTime()), red("INFO"), cyan(name), red("errored"))
					errorMutex.Unlock()
				}
			}(task.Name, task.Cmds, task.Silent, variables, task.CtrlC)
		} else {
			err := runTask(task.Name, task.CtrlC, task.Cmds, task.Silent, variables, cyan, magenta, white, yellow, red, green)

			if ctrlc_flag == true {
				<-doneCtrlcList
			}

			if err != nil {
				errorOccurred = true
				fmt.Printf("[%s] [%s] Module '%s' %s ❌\n", yellow(currentTime()), red("INFO"), cyan(task.Name), red("errored"))

				break // Exit the function immediately if an error occurs
			}
		}
	}

	wg.Wait()

	if errorOccurred {
		if ctrlc_flag == true {

			doneTask <- "all_task_done"

		Loop:
			for {
				select {
				case msg := <-doneTask:
					if msg == "ctrlc_done" {
						break Loop
					}
				}
			}
		}

		os.Exit(1) // Exit with error code 1
	}

	fmt.Printf("[%s] [%s] All modules completed successfully ✅\n", yellow(currentTime()), yellow("INFO"))
}

func removeCtrlCActions(ctrlcList []string, actions []string) []string {
	result := []string{}
	for _, action := range ctrlcList {
		found := false
		for _, toRemove := range actions {
			if action == toRemove {
				found = true
				break
			}
		}
		if !found {
			result = append(result, action)
		}
	}
	return result
}

func runTask(taskName string, taskctrlc []string, cmds []string, silent bool, vars map[string]string, cyan, magenta, white, yellow, red, green func(a ...interface{}) string) error {

	currentTime()
	fmt.Printf("[%s] [%s] Module '%s' %s ✨\n", yellow(currentTime()), yellow("INFO"), cyan(taskName), yellow("running"))

	// 在任务开始时添加ctrlc内容
	ctrlcList = append(ctrlcList, taskctrlc...)

	var hasError bool
	for _, cmd := range cmds {

		err := executeCommand(cmd, silent, vars)

		if err != nil {
			hasError = true
			break
		}
	}

	if hasError {
		return fmt.Errorf("Module '%s' %s ❌", taskName, red("errored"))
	}

	fmt.Printf("[%s] [%s] Module '%s' %s ✅\n", yellow(currentTime()), yellow("INFO"), cyan(taskName), green("completed"))

	// 在任务完成后移除ctrlc内容
	ctrlcList = removeCtrlCActions(ctrlcList, taskctrlc)
	return nil
}

// 修改
func executeCommand(cmdStr string, silent bool, vars map[string]string) error {

	if silent {
		if strings.Contains(cmdStr, "docker") && strings.Contains(cmdStr, "run") && strings.Index(cmdStr, "docker") < strings.Index(cmdStr, "run") && strings.Index(cmdStr, "run") < strings.Index(cmdStr, "-it") {
			cmdStr = strings.ReplaceAll(cmdStr, "-it", "-i") // 示例操作
		}
	}

	cmdStr = replacePlaceholders(cmdStr, vars)
	// fmt.Printf("%s\n", cmdStr)
	execCmd := exec.Command("sh", "-c", cmdStr)
	if silent {
		execCmd.Stdout = nil
		execCmd.Stderr = nil
	} else {
		execCmd.Stdin = os.Stdin // 支持docker交互式运行,即支持-it参数
		execCmd.Stdout = os.Stdout
		execCmd.Stderr = os.Stderr
	}

	err := execCmd.Run()
	if err != nil {
		return fmt.Errorf("command execution failed: %w", err)
	}

	return nil
}

func replacePlaceholders(input string, vars map[string]string) string {

	for key, value := range vars {
		placeholder := fmt.Sprintf("{{%s}}", key)
		input = strings.ReplaceAll(input, placeholder, value)
	}

	if strings.Contains(input, "{{YamlName}}") {
		input = strings.ReplaceAll(input, "{{YamlName}}", taskFile)
	}

	return input
}

func currentTime() string {
	return time.Now().Format("2006-01-02 15:04:05")
}
