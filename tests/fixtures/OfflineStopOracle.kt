fun main(args: Array<String>) {
    for (line in java.io.File(args[0]).readLines()) {
        val fields = line.split(',')
        val position = fields[0].toLong()
        val duration = fields[1].toLong()
        val percentage = position.div(duration.toFloat()).times(100).toInt()
        val saved = if (percentage < 10 || percentage > 90) 0L else position
        val played = percentage > 90
        println("$position,$duration,$percentage,$saved,$played")
    }
}
